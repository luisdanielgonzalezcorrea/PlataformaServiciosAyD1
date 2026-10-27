// Ayudas para las pruebas de contrato.
// Idea: el front hace la llamada de verdad (axios), pero en vez de salir a la red un
// "adaptador" la intercepta, la compara con lo que dice contracts/api-servas-swagger.yaml
// y responde con un ejemplo generado a partir del mismo Swagger.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { httpClient } from "../../src/api/httpClient";

const spec = yaml.load(
  fs.readFileSync(path.resolve(__dirname, "../../contracts/api-servas-swagger.yaml"), "utf8")
);

export const KNOWN_DIVERGENCES = {
  // Swagger y código del back no coinciden. El front sigue el CÓDIGO (es lo que responde de verdad).
  // Se listan acá para que no se pierdan: AyD2 debe corregir el Swagger o el controlador.
  QUERY_CAMEL: {
    "GET /services": {
      companyId: "Swagger dice company_id; CatalogController usa @RequestParam companyId",
      comunaId: "Swagger dice comuna_id; CatalogController usa @RequestParam comunaId",
    },
  },
  MISSING_IN_SWAGGER: {
    "POST /reservations/{id}/confirm": "Existe en ReservationController pero no está en el Swagger",
    "GET /services/{id}/availability/month": "Endpoint nuevo del back (PR feat/pendientes-ayd1); esta copia del Swagger todavía no lo trae",
  },
};

function resolve(node) {
  if (node && node.$ref) {
    const parts = node.$ref.replace("#/", "").split("/");
    return resolve(parts.reduce((acc, p) => acc[p], spec));
  }
  return node;
}

const templates = Object.keys(spec.paths).map((tpl) => ({
  tpl,
  re: new RegExp("^" + tpl.replace(/\{[^}]+\}/g, "[^/]+") + "$"),
}));

export function findOperation(method, url) {
  const clean = url.split("?")[0];
  const hit = templates.find((t) => t.re.test(clean));
  if (!hit) {
    // ¿Es una ruta que existe en el código del back pero falta en el Swagger?
    for (const known of Object.keys(KNOWN_DIVERGENCES.MISSING_IN_SWAGGER)) {
      const [m, tpl] = known.split(" ");
      const re = new RegExp("^" + tpl.replace(/\{[^}]+\}/g, "[^/]+") + "$");
      if (m === method.toUpperCase() && re.test(clean)) return { key: known };
    }
    return { key: `${method.toUpperCase()} ${clean}` };
  }
  const item = spec.paths[hit.tpl];
  const op = item[method.toLowerCase()];
  return { key: `${method.toUpperCase()} ${hit.tpl}`, tpl: hit.tpl, op, pathParams: item.parameters || [] };
}

// ---------- validación de cuerpos ----------
export function validateAgainst(schemaIn, value, where = "body") {
  const errors = [];
  const schema = resolve(schemaIn);
  if (!schema) return errors;
  if (schema.nullable && value === null) return errors;
  const type = schema.type || (schema.properties ? "object" : undefined);

  if (type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return [`${where}: se esperaba un objeto`];
    }
    const props = schema.properties || {};
    for (const req of schema.required || []) {
      if (!(req in value) || value[req] === undefined) errors.push(`${where}.${req}: falta (obligatorio)`);
    }
    for (const [k, v] of Object.entries(value)) {
      if (!(k in props)) {
        if (schema.additionalProperties === true) continue;
        errors.push(`${where}.${k}: el contrato no define este campo (¿camelCase vs snake_case?)`);
      } else if (v !== undefined) {
        errors.push(...validateAgainst(props[k], v, `${where}.${k}`));
      }
    }
  } else if (type === "array") {
    if (!Array.isArray(value)) return [`${where}: se esperaba un arreglo`];
    value.forEach((item, i) => errors.push(...validateAgainst(schema.items, item, `${where}[${i}]`)));
  } else if (type === "string") {
    if (typeof value !== "string") errors.push(`${where}: se esperaba texto`);
    else if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${where}: "${value}" no está en ${JSON.stringify(schema.enum)}`);
    }
  } else if (type === "integer" || type === "number") {
    if (typeof value !== "number") errors.push(`${where}: se esperaba número`);
  } else if (type === "boolean") {
    if (typeof value !== "boolean") errors.push(`${where}: se esperaba booleano`);
  }
  return errors;
}

// ---------- respuestas de ejemplo generadas del Swagger ----------
export function sample(schemaIn) {
  const schema = resolve(schemaIn);
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.enum) return schema.enum[0];
  if (schema.type === "array") return [sample(schema.items)];
  if (schema.type === "object" || schema.properties) {
    const out = {};
    for (const [k, v] of Object.entries(schema.properties || {})) out[k] = sample(v);
    return out;
  }
  if (schema.type === "integer" || schema.type === "number") return 1;
  if (schema.type === "boolean") return true;
  if (schema.format === "uuid") return "8f14e45f-ea5b-4b1c-9d3a-2c7f6b0a1e93";
  if (schema.format === "date") return "2099-01-05";
  if (schema.format === "email") return "demo@correo.co";
  return "texto";
}

function okResponse(op) {
  const code = Object.keys(op.responses || {}).find((c) => c.startsWith("2"));
  const res = resolve(op.responses[code]);
  const schema = res?.content?.["application/json"]?.schema;
  return { status: Number(code), data: schema ? sample(schema) : {} };
}

// ---------- el adaptador que intercepta ----------
export const calls = [];

export function installContractAdapter({ overrides = {} } = {}) {
  calls.length = 0;
  httpClient.defaults.adapter = async (config) => {
    const method = (config.method || "get").toUpperCase();
    const { key, tpl, op } = findOperation(method, config.url);
    const problems = [];
    const known = KNOWN_DIVERGENCES.MISSING_IN_SWAGGER[key];

    if (!op && !known) problems.push(`${key}: la ruta o el método NO existen en el Swagger`);

    if (op) {
      // query
      const declared = (op.parameters || []).filter((p) => p.in === "query").map((p) => p.name);
      const divergences = KNOWN_DIVERGENCES.QUERY_CAMEL[key] || {};
      for (const name of Object.keys(config.params || {})) {
        if (!declared.includes(name) && !divergences[name] && !["page", "size", "sort"].includes(name)) {
          problems.push(`${key}: el parámetro de query "${name}" no está en el Swagger`);
        }
      }
      // body
      const content = resolve(op.requestBody)?.content || {};
      if (config.data !== undefined && config.data !== null) {
        if (config.data instanceof FormData) {
          const schema = content["multipart/form-data"]?.schema;
          if (!schema) problems.push(`${key}: manda multipart y el contrato no lo define`);
          else {
            const body = {};
            for (const [k, v] of config.data.entries()) body[k] = v instanceof Blob ? "binario" : v;
            problems.push(...validateAgainst({ ...schema, properties: Object.fromEntries(
              Object.entries(schema.properties).map(([k, v]) => [k, v.format === "binary" ? { type: "string" } : v]),
            ) }, body).map((e) => `${key}: ${e}`));
          }
        } else {
          const schema = content["application/json"]?.schema;
          const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
          if (!schema) problems.push(`${key}: manda JSON y el contrato no define cuerpo`);
          else problems.push(...validateAgainst(schema, body).map((e) => `${key}: ${e}`));
        }
      } else if (resolve(op.requestBody)?.required) {
        problems.push(`${key}: el contrato exige cuerpo y el front no mandó nada`);
      }
      // seguridad
      const needsAuth = (op.security || []).some((s) => s.bearerAuth) && !(op.security || []).some((s) => Object.keys(s).length === 0);
      if (needsAuth && !config.headers?.Authorization) {
        problems.push(`${key}: requiere Bearer token y el front no lo mandó`);
      }
    }

    calls.push({ key, method, url: config.url, params: config.params, problems, config });

    const forced = overrides[key];
    const res = forced || (op ? okResponse(op) : { status: 200, data: {} });
    return { data: res.data, status: res.status, statusText: "OK", headers: {}, config };
  };
}

export function expectNoContractProblems() {
  const all = calls.flatMap((c) => c.problems);
  if (all.length) throw new Error("Incumplimientos del contrato:\n - " + all.join("\n - "));
}

export { spec };
