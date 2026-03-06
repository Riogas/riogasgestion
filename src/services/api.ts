import { api, overpassApi } from "@/lib/axios";
import { withApiLogging, setSentryUser, clearSentryUser } from "@/lib/sentryHelpers";
import { setAuthToken } from "@/lib/authToken";

// Tipos globales
export type Role = "admin" | "user";

export interface User {
  name: string;
  email: string;
  role: Role;
  token: string;
}

export interface MenuItem {
  label: string;
  icon: string;
  path: string;
  // Campos opcionales que puede devolver el backend
  order?: number;
  key?: string;
  // Nuevos campos del backend
  enabled?: boolean;
  visible?: boolean;
  type?: string;
  style?: string;
  children?: MenuItem[];
}

// ✅ Función de login real
export const apiLogin = async (
  email: string,
  password: string,
): Promise<{ data: { success: boolean; user: User } }> => {
  return withApiLogging(
    "/login",
    async () => {
      // Llamada real al backend
      const body = {
        UserName: email, // el front pasaba email/usuario; el backend espera UserName
        Password: password,
      };

      const { data } = await api.post("/login", body);

      // La API devuelve { RespuestaLogin: "{...json...} basura extra" }
      // El backend GeneXus agrega texto extra después del JSON, hay que extraer solo el JSON
      const raw = data?.RespuestaLogin ?? "{}";
      const jsonEnd = raw.lastIndexOf("}");
      const cleanJson = jsonEnd >= 0 ? raw.substring(0, jsonEnd + 1) : raw;
      const parsed = JSON.parse(cleanJson);

      if (!parsed?.success) {
        throw new Error(parsed?.message || "Credenciales inválidas");
      }

      // Persistir token
      const token: string = parsed?.token;
      if (token) setAuthToken(token);

      // Mapear user para el front
      const gxUser = parsed?.user || {};
      const user: User = {
        name: gxUser?.nombre || gxUser?.username || "",
        email: gxUser?.email || "",
        role: (gxUser?.isRoot === "S" ? "admin" : "user") as Role,
        token,
      };

      // Configurar usuario en Sentry
      setSentryUser({
        id: gxUser?.username || gxUser?.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      return { data: { success: true, user } };
    },
    "POST",
    { email, password: "[HIDDEN]" }
  );
};

// ✅ Menú por rol desde backend
// 👇 si esto corre en el cliente, SOLO vas a ver NEXT_PUBLIC_*
const APP_ID = Number(process.env.NEXT_PUBLIC_APLICACION_ID ?? 0);

function getAppIdSafe(): number {
  if (!Number.isFinite(APP_ID) || APP_ID <= 0) {
    console.warn("[api.menuApp] NEXT_PUBLIC_APLICACION_ID no configurado. Usando 0.");
    return 0;
  }
  return APP_ID;
}

function normalizeBool(v: any): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  return s === "true" || s === "1" || s === "s" || s === "yes";
}

function toNumber(n: any, d: number = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : d;
}

function mapMenuItem(raw: any): MenuItem {
  const childrenRaw = Array.isArray(raw?.children) ? raw.children : [];
  const mappedChildren = childrenRaw
    .map(mapMenuItem)
    .sort((a: MenuItem, b: MenuItem) => (a.order ?? 0) - (b.order ?? 0));
  return {
    label: raw?.label ?? "",
    icon: raw?.icon ?? "list",
    path: raw?.path ?? "#",
    key: raw?.key ?? raw?.path ?? raw?.label ?? undefined,
    order: toNumber(raw?.order, 0),
    enabled: normalizeBool(raw?.enabled),
    visible: normalizeBool(raw?.visible),
    type: raw?.type ?? undefined,
    style: raw?.style ?? undefined,
    children: mappedChildren,
  };
}

function sanitizeChildren(raw: string): string {
  return raw
    .replace(/"children"\s*:\s*}/g, '"children":[]}')
    .replace(/"children"\s*:\s*,/g, '"children":[],');
}

function tryParseJson(raw: string, ctx: string): any {
  const log = (...args: any[]) => console.log("[api.menuApp]", ...args);
  try {
    const parsed = JSON.parse(raw);
    log(`JSON.parse OK (${ctx}). keys=`, Object.keys(parsed || {}));
    return parsed;
  } catch (e1) {
    log(`JSON.parse FAILED (${ctx}). Trying sanitize...`, (e1 as any)?.message);
    try {
      const parsed2 = JSON.parse(sanitizeChildren(raw));
      log(`Sanitized parse OK (${ctx}). keys=`, Object.keys(parsed2 || {}));
      return parsed2;
    } catch (e2) {
      log(`Sanitized parse FAILED (${ctx}).`, (e2 as any)?.message);
      return {};
    }
  }
}

function safeParseMenuEnvelope(data: any): any {
  const log = (...args: any[]) => console.log("[api.menuApp]", ...args);
  let level1: any = {};
  try {
    if (typeof data?.RespuestaLogin === "string") {
      const raw = data.RespuestaLogin as string;
      log("RespuestaLogin len=", raw.length);
      level1 = tryParseJson(raw, "RespuestaLogin");
    } else if (typeof data === "object" && data) {
      log("Direct object response. keys=", Object.keys(data));
      level1 = data;
    }
  } catch (e) {
    console.warn("[api.menuApp] Unexpected parse error:", (e as any)?.message);
    level1 = {};
  }

  // Algunos backends envuelven el menú en 'resp' como string JSON
  if (level1 && typeof level1.resp === "string") {
    const inner = tryParseJson(level1.resp as string, "resp");
    // Si el inner contiene 'menu', devolvemos ese nivel; si no, devolvemos level1
    if (inner && (Array.isArray(inner.menu) || Array.isArray(inner.sdtPuntosMenu))) {
      return inner;
    }
  }

  return level1 || {};
}

export const apiGetMenuByRole = async (role: Role): Promise<MenuItem[]> => {
  // No uses assert sin promesa: evita throw sin catch
  const appId = getAppIdSafe();

  return withApiLogging(
    "/menuApp",
    async () => {
      const body = { AplicacionId: appId };
      console.log("[api.menuApp] POST /menuApp body=", body, "role=", role);

      const { data } = await api.post("/menuApp", body);
      console.log("[api.menuApp] raw axios data keys=", typeof data === "object" ? Object.keys(data || {}) : typeof data);

      const parsed = safeParseMenuEnvelope(data);
      console.log("[api.menuApp] parsed.errid=", parsed?.errid, "mensaje=", parsed?.mensaje);

      const rawItems: any[] = Array.isArray(parsed?.menu)
        ? parsed.menu
        : Array.isArray(parsed?.sdtPuntosMenu)
          ? parsed.sdtPuntosMenu
          : [];
      console.log("[api.menuApp] rawItems length=", rawItems.length);

      const items: MenuItem[] = rawItems
        .map(mapMenuItem)
        .sort((a: MenuItem, b: MenuItem) => (a.order ?? 0) - (b.order ?? 0));

      console.log("[api.menuApp] mapped items length=", items.length);
      if (items.length) {
        console.log("[api.menuApp] first item sample=", {
          label: items[0].label,
          path: items[0].path,
          icon: items[0].icon,
          order: items[0].order,
          children: items[0].children?.length ?? 0,
        });
      }

      return items;
    },
    "POST",
    // meta extra para logging/observabilidad
    { AplicacionId: appId, Role: role }
  );
};


// ✅ Funciones reales (cuando el backend esté listo)
export const apiGetCurrentUser = () =>
  withApiLogging(
    "/auth/me",
    async () => {
      const response = await api.get("/auth/me");
      return response.data;
    },
    "GET"
  );

export const apiUpdateProfile = (data: { name: string; avatar?: string }) =>
  api.put("/user/profile", data);

export const apiDeleteAccount = () => api.delete("/user");

// Nuevas funciones para importar localidades
export const importarLocalidades = async (departamento: string) => {
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      area["name"="${departamento}"]["admin_level"="4"]->.searchArea;
      node["place"]["name"](area.searchArea);
      out body;
    `;

    const response = await overpassApi.post(
      "http://overpass.riogas.uy/api/interpreter",
      overpassQuery,
      {
        headers: { "Content-Type": "text/plain" },
      },
    );

    return response.data.elements.map((node: any) => ({
      id: node.id,
      lat: node.lat,
      lon: node.lon,
      alt_name: node.tags.alt_name || null,
      name: node.tags.name,
      place: node.tags.place,
      population: node.tags.population || null,
      departamento,
    }));
  } catch (error) {
    console.error("Error al obtener localidades desde Overpass:", error);
    throw error;
  }
};

export const sendLocalidadToService = async (localidad: any) => {
  try {
    const response = await api.post("/ImportarLocalidades", localidad, {
      withCredentials: true,
    });
    console.log(`Localidad enviada correctamente: ${localidad.name}`);
  } catch (error) {
    console.error(`Error al enviar la localidad ${localidad.name}:`, error);
    throw error;
  }
};

// Nueva función para importar calles
export const importarCalles = async (
  departamento: string,
  localidad: string,
) => {
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      area["name"="Uruguay"]["admin_level"="2"]->.country;
      area["name"="${departamento}"]["admin_level"="4"](area.country)->.depArea;
      area["name"="${localidad}"]["admin_level"="8"](area.depArea)->.searchArea;
      (
        way["highway"]["name"](area.searchArea);
      );
      out tags;
    `;
    const response = await overpassApi.post(
      "http://overpass.riogas.uy/api/interpreter",
      overpassQuery,
      {
        headers: { "Content-Type": "text/plain" },
      },
    );
    // Unificar calles por nombre
    const uniqueStreets = Array.from(
      new Map(
        response.data.elements.map((way: any) => [
          way.tags.name,
          { name: way.tags.name, old_name: way.tags.old_name || "N/A" },
        ]),
      ).values(),
    );
    return uniqueStreets;
  } catch (error) {
    console.error("Error al obtener calles desde Overpass:", error);
    throw error;
  }
};

// Nueva función para importar departamentos
export const importarDepartamentos = async () => {
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      area["name"="Uruguay"]["admin_level"="2"]->.searchArea;
      relation["admin_level"="4"]["boundary"="administrative"](area.searchArea);
      out body;
    `;
    const response = await overpassApi.post(
      "http://overpass.riogas.uy/api/interpreter",
      overpassQuery,
      {
        headers: { "Content-Type": "text/plain" },
      },
    );
    return response.data.elements.map((rel: any) => ({
      name: rel.tags.name,
      osm_id: rel.id,
      admin_level: rel.tags.admin_level,
      type: rel.tags.type,
      boundary: rel.tags.boundary,
      // Puedes agregar más campos si los necesitas
    }));
  } catch (error) {
    console.error("Error al obtener departamentos desde Overpass:", error);
    throw error;
  }
};

export const apiGetDepartamentos = async () =>
  withApiLogging(
    "/getDepartamentos",
    async () => {
      const response = await api.get("/getDepartamentos");
      // Normalizar campos OSM -> sin prefijo
      if (response.data?.sdtDepartamentos) {
        response.data.sdtDepartamentos = response.data.sdtDepartamentos.map((d: any) => normalizeOSMFields(d, 'Departamento'));
      }
      return response.data;
    },
    "GET"
  );

export const apiImportarDepartamentos = async (body: {
  sdtDepartamentos: { DepartamentoId: string; DepartamentoNombre: string }[];
}) =>
  withApiLogging(
    "/importarDepartamentos",
    async () => {
      const response = await api.post("/importarDepartamentos", body, {
        headers: { "Content-Type": "application/json" },
      });
      return response.data;
    },
    "POST",
    body
  );

export const apiCambiarEstadoDepartamento = async (
  departamentoId: string,
  nuevoEstado: string,
) => {
  try {
    const response = await api.put(
      `/actualizarDepartamentos`,
      {
        DepartamentoId: departamentoId,
        DepartamentoEstado: nuevoEstado,
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    console.log(
      `Estado del departamento ${departamentoId} cambiado a ${nuevoEstado}:`,
      response.data,
    );
    return response.data;
  } catch (error: any) {
    console.error(
      `Error al cambiar estado del departamento ${departamentoId}:`,
      error.response?.data || error.message,
    );
    throw error;
  }
};

// Normalizar campos con prefijo OSM del backend GeneXus
function normalizeOSMFields(obj: any, prefix: string): any {
  const result = { ...obj };
  for (const key of Object.keys(obj)) {
    if (key.startsWith('OSM')) {
      const normalizedKey = key.replace(/^OSM/, '');
      // Solo asignar si el campo sin prefijo no existe o está vacío
      if (result[normalizedKey] === undefined || result[normalizedKey] === null || result[normalizedKey] === '') {
        result[normalizedKey] = obj[key];
      }
    }
  }
  return result;
}

export const apiGetLocalidades = async (body: { DepartamentoId: string }) => {
  try {
    console.log("Body enviado a /getLocalidades:", body);
    const response = await api.post("/getLocalidades", body, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("Localidades obtenidas:", response.data);
    // Normalizar campos OSM -> sin prefijo
    if (response.data?.sdtLocalidad) {
      response.data.sdtLocalidad = response.data.sdtLocalidad.map((loc: any) => normalizeOSMFields(loc, 'Localidad'));
    }
    return response.data;
  } catch (error: any) {
    console.error(
      "Error al obtener localidades:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

export const apiImportarLocalidades = async (body: {
  sdtLocalidad: {
    DepartamentoId: number;
    LocalidadId: number;
    LocalidadNombre: string;
    LocalidadEstado: string;
    LocalidadLatitud: number;
    LocalidadLongitud: number;
    LocalidadReferencia: string;
    LocalidadTipo: string;
    LocalidadType: string;
    LocalidadAddressType: string;
  }[];
}) => {
  try {
    const response = await api.post("/importarLocalidades", body, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("Localidades importadas correctamente:", response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      "Error al importar localidades:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

export const apiImportarCalles = async (body: {
  sdtCalles: {
    DepartamentoId: number;
    LocalidadId: number;
    CalleNombre: string;
    CalleLatitud: number;
    CalleLongitud: number;
    CalleEstado: string;
    CalleReferencia: string;
    CalleNombreLargo: string;
    CalleTipo: string;
    CalleSuperficie: string;
  }[];
}) => {
  try {
    const response = await api.post("/importarCalles", body, {
      headers: { "Content-Type": "application/json" },
    });
    console.log("Calles importadas correctamente:", response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      "Error al importar calles:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

export const obtenerCallesDesdeCoordenadas = async (
  lat?: number,
  lon?: number,
  nombre?: string,
) => {
  try {
    console.log("obtenerCallesDesdeCoordenadas:", lat, lon, nombre);
    // Si recibimos coordenadas válidas, intentamos por coordenadas
    if (typeof lat === "number" && typeof lon === "number") {
      const buscarRelacionQuery = `
        [out:json][timeout:25];
        is_in(${lat}, ${lon});
        area._["admin_level"="8"]["boundary"="administrative"];
        out ids tags;
      `;

      const relResponse = await fetch("http://overpass.riogas.uy/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: buscarRelacionQuery,
      });

      if (relResponse.ok) {
        const relData = await relResponse.json();
        const areaId = relData.elements?.[0]?.id;
        if (areaId) {
          const overpassQuery = `
            [out:json][timeout:60];
            way(area:${areaId})["highway"]["name"];
            out tags center;
          `;
          const callesResponse = await fetch(
            "http://overpass.riogas.uy/api/interpreter",
            {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              body: overpassQuery,
            },
          );

          if (!callesResponse.ok) {
            throw new Error("Error al obtener calles desde Overpass API");
          }

          const data = await callesResponse.json();
          return data.elements.map((el: any) => ({
            id: el.id,
            name: el.tags?.name || "Sin nombre",
            tipo: el.tags?.highway || "Desconocido",
            lat: el.center?.lat,
            lon: el.center?.lon,
            highway: el.tags?.highway || null,
            surface: el.tags?.surface || null,
            old_name: el.tags?.old_name || null,
          }));
        }
      }
    }

    // Si no hay coordenadas válidas o no se encontró área, buscar por nombre
    if (nombre && typeof nombre === "string") {
      let areaId: number | undefined;
      // Buscar por admin_level=8
      const buscarAreaQuery = `
        [out:json][timeout:25];
        area["name"="${nombre}"]["admin_level"="8"];
        out ids tags;
      `;
      let areaResponse = await fetch("http://overpass.riogas.uy/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: buscarAreaQuery,
      });
      if (areaResponse.ok) {
        const areaData = await areaResponse.json();
        areaId = areaData.elements?.[0]?.id;
      }
      // Si no encontró, intentar con admin_level=4
      if (!areaId) {
        const buscarArea4Query = `
          [out:json][timeout:25];
          area["name"="${nombre}"]["admin_level"="4"];
          out ids tags;
        `;
        areaResponse = await fetch("http://overpass.riogas.uy/api/interpreter", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: buscarArea4Query,
        });
        if (areaResponse.ok) {
          const areaData = await areaResponse.json();
          areaId = areaData.elements?.[0]?.id;
        }
      }
      if (areaId) {
        // Buscar calles en el área encontrada
        const overpassQuery = `
          [out:json][timeout:60];
          way(area:${areaId})["highway"]["name"];
          out tags center;
        `;
        const callesResponse = await fetch(
          "http://overpass.riogas.uy/api/interpreter",
          {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: overpassQuery,
          },
        );
        if (!callesResponse.ok) {
          throw new Error("Error al obtener calles desde Overpass API por nombre");
        }
        const data = await callesResponse.json();
        return data.elements.map((el: any) => ({
          id: el.id,
          name: el.tags?.name || "Sin nombre",
          tipo: el.tags?.highway || "Desconocido",
          lat: el.center?.lat,
          lon: el.center?.lon,
          highway: el.tags?.highway || null,
          surface: el.tags?.surface || null,
          old_name: el.tags?.old_name || null,
        }));
      }

      // Si no se encontró área por nombre, usar bounding box desde Nominatim
      const responseNominatim = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          nombre + ", Uruguay",
        )}`,
        {
          headers: {
            "User-Agent": "TuApp/1.0 (tu@email.com)",
          },
        },
      );

      const nominatimData = await responseNominatim.json();

      if (nominatimData.length > 0) {
        const bbox = nominatimData[0].boundingbox;
        const [south, north, west, east] = bbox.map(parseFloat);

        const bboxQuery = `
          [out:json][timeout:60];
          (
            way["highway"]["name"](${south}, ${west}, ${north}, ${east});
          );
          out tags center;
        `;

        const callesResponse = await fetch(
          "http://overpass.riogas.uy/api/interpreter",
          {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: bboxQuery,
          },
        );

        if (!callesResponse.ok) {
          throw new Error("Error al obtener calles desde Overpass API por bounding box");
        }

        const data = await callesResponse.json();
        return data.elements.map((el: any) => ({
          id: el.id,
          name: el.tags?.name || "Sin nombre",
          tipo: el.tags?.highway || "Desconocido",
          lat: el.center?.lat,
          lon: el.center?.lon,
          highway: el.tags?.highway || null,
          surface: el.tags?.surface || null,
          old_name: el.tags?.old_name || null,
        }));
      }

      throw new Error(`No se encontró la localidad: ${nombre} ni por bounding box`);
    }

    throw new Error("No se pudo obtener calles: se requieren coordenadas o nombre válido");
  } catch (error) {
    console.error("Error general:", error);
    throw error;
  }
};


export const apiGetPolygonForLocalidad = async (lat: number, lon: number) => {
  try {
    const makeQuery = (adminLevel: number) => `
      [out:json][timeout:60];
      is_in(${lat}, ${lon})->.a;
      (
        rel(pivot.a)["boundary"="administrative"]["admin_level"="${adminLevel}"];
      );
      out body;
      >;
      out skel qt;
    `;

    const tryAdminLevels = [10, 9, 8]; // Primero barrios, después ciudades
    for (const level of tryAdminLevels) {
      console.log(`🔍 Buscando polígonos con admin_level=${level} para (${lat}, ${lon})`);
      const response = await overpassApi.post("/interpreter", makeQuery(level), {
        headers: {
          "Content-Type": "text/plain",
          "User-Agent": "RioGasGestion/1.0 (tu@email.com)",
        },
      });

      if (response.data?.elements?.length > 0) {
        console.log(`✅ Polígonos encontrados con admin_level=${level}`);
        return response.data;
      }
      console.warn(`⚠️ No se encontraron elementos para admin_level=${level}`);
    }

    console.error(`❌ No se encontraron polígonos administrativos para (${lat}, ${lon})`);
    return null;

  } catch (error) {
    console.error(`❌ Error al buscar polígonos para (${lat}, ${lon})`, error);
    return null;
  }
};




export const apiActualizarEstadoLocalidad = async (body: {
  LocalidadId: number;
  LocalidadEstado: string;
}) => {
  const response = await api.post(`/actualizarEstadoLocalidad`, body, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.status !== 200) {
    throw new Error("Failed to update localidad state");
  }

  return response.data;
};

export const apiGetCalles = async (body: {
  DepartamentoId: number;
  LocalidadId: number;
}) => {
  try {
    // El backend espera campos con prefijo OSM
    const osmBody = {
      OSMDepartamentoId: body.DepartamentoId,
      OSMLocalidadId: body.LocalidadId,
    };
    const response = await api.post("/getCalles", osmBody, {
      headers: { "Content-Type": "application/json" },
    });

    if (response.status !== 200) {
      throw new Error("Failed to fetch calles");
    }

    // Normalizar campos OSM -> sin prefijo
    if (response.data?.sdtCalles) {
      response.data.sdtCalles = response.data.sdtCalles.map((c: any) => normalizeOSMFields(c, 'Calle'));
    }

    return response.data;
  } catch (error: any) {
    console.error(
      "Error fetching calles:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

//apiActualizarEstadoCalle
export const apiActualizarEstadoCalle = async (body: {
  CalleId: number;
  CalleEstado: string;
}) => {
  const response = await api.post(`/actualizarEstadoCalle`, body, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.status !== 200) {
    throw new Error("Failed to update calle state");
  }

  return response.data;
};

export const apiGetCallesICA = async (body: {
  DepartamentoId: number;
  LocalidadId: number;
}) => {
  try {
    const response = await api.post("/getCallesICA", body, {
      headers: { "Content-Type": "application/json" },
    });

    if (response.status !== 200) {
      throw new Error("Failed to fetch calles");
    }

    // Normalizar campos OSM -> sin prefijo
    if (response.data?.sdtCalles) {
      response.data.sdtCalles = response.data.sdtCalles.map((c: any) => normalizeOSMFields(c, 'Calle'));
    }

    return response.data;
  } catch (error: any) {
    console.error(
      "Error fetching calles:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

// ✅ Servicios para Puestos
// Mapa de claves DV_P_P_* → PascalCase esperado por el frontend
const PUESTO_KEY_MAP: Record<string, string> = {
  DV_P_P_PUESTOID: "PuestoId",
  DV_P_P_PUESTODSC: "PuestoDsc",
  DV_P_P_PUESTOESTADO: "PuestoEstado",
  DV_P_P_PUESTOACEPTAAGENDAR: "PuestoAceptaAgendar",
  DV_P_P_PUESTOATRASO: "PuestoAtraso",
  DV_P_P_PUESTOAUTOPEDIDO: "PuestoAutoPedido",
  DV_P_P_PUESTOCALID: "PuestoCalId",
  DV_P_P_PUESTOCALLESID: "PuestoCallesId",
  DV_P_P_PUESTODIR: "PuestoDir",
  DV_P_P_PUESTOFLETECANTIDAD: "PuestoFleteCantidad",
  DV_P_P_PUESTOFLETECOBRA: "PuestoFleteCobra",
  DV_P_P_PUESTOFUERZAAUTOPEDIDO: "PuestoFuerzaAutopedido",
  DV_P_P_PuestoGCINro: "PuestoGCINro",
  DV_P_P_PUESTOGPSEFLETERA: "PuestoGPSEFletera",
  DV_P_P_PUESTOHORARIOS: "PuestoHorarios",
  DV_P_P_PUESTOPALABRAAUTOPEDIDO: "PuestoPalabraAutopedido",
  DV_P_P_PuestoPruebas: "PuestoPruebas",
  DV_P_P_PUESTOSCOORDX: "PuestosCoordX",
  DV_P_P_PUESTOSCOORDY: "PuestosCoordY",
  DV_P_P_PUESTOSULTMOD: "PuestosUltMod",
  DV_P_P_PUESTOTELULTLIN: "PuestoTelUltLin",
  DV_P_P_PUESTOUBICACION: "PuestoUbicacion",
  DV_P_P_PUESTOWAPPACTIVO: "PuestoWappActivo",
  DV_P_P_PUESTOZONID: "PuestoZonId",
};

/** Normaliza un objeto puesto: convierte claves DV_P_P_* al formato PascalCase esperado */
function normalizePuesto(raw: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    const mapped = PUESTO_KEY_MAP[key];
    result[mapped ?? key] = value;
  }
  return result;
}

export const apiGetPuestos = async (puestoId: string = "") => {
  return withApiLogging(
    "/getPuestos",
    async () => {
      const response = await api.post("/getPuestos", {
        PuestoId: puestoId,
      });
      const data = response.data;
      // Normalizar claves si vienen con prefijo DV_P_P_
      if (Array.isArray(data?.sdtPuestosData)) {
        data.sdtPuestosData = data.sdtPuestosData.map(normalizePuesto);
      }
      return data;
    },
    "POST",
    { PuestoId: puestoId }
  );
};

// ✅ Servicios para Tipos de Capa
export const apiGetTiposCapa = async () => {
  try {
    const response = await api.post("/getTipoCapa", {
      PuestoId: "",
    });
    return response.data;
  } catch (error: any) {
    console.error(
      "Error fetching tipos de capa:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

// ✅ Servicios para Importar Zona
export const apiImportarZona = async (
  puestoId: number,
  tipoCapa: number,
  capaNombre: string,
  capaGeoJson: string,
  zonaGeoJson: string
) => {
  try {
    // Log de los parámetros recibidos
    console.log('[apiImportarZona] params:', { puestoId, tipoCapa, capaNombre, capaGeoJson, zonaGeoJson });
    const response = await api.post("/ImportarZona", {
      PuestoId: puestoId,
      TipoCapa: tipoCapa,
      CapaNombre: capaNombre,
      CapaGeoJson: capaGeoJson,
      ZonaGeoJson: zonaGeoJson,
    });
    return response.data;
  } catch (error: any) {
    console.error(
      "Error al importar zona:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

// ✅ Servicios para ABM Tipos de Capa
export const apiABMTipoCapa = async (
  modo: string,
  tipoCapaId: number,
  nombre: string,
  estado: string
) => {
  try {
    const response = await api.post("/ABMTipoCapa", {
      Modo: modo,
      TipoCapaId: tipoCapaId,
      TipoCapaNombre: nombre,
      TipoCapaEstado: estado,
    });
    return response.data;
  } catch (error: any) {
    console.error(
      "Error en ABM tipos de capa:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

// ✅ Servicios para ABM Puestos
export function apiABMPuesto(body: any): Promise<any>;
export function apiABMPuesto(
  modo: string,
  puestoId: number,
  descripcion: string,
  estado: string
): Promise<any>;
export async function apiABMPuesto(
  a: any,
  b?: number,
  c?: string,
  d?: string
): Promise<any> {
  try {
    const payload = typeof a === "object"
      ? a
      : {
          Modo: a,
          PuestoId: b,
          PuestoDsc: c,
          PuestoEstado: d,
        };
    const response = await api.post("/ABMPuesto", payload);
    return response.data;
  } catch (error: any) {
    console.error(
      "Error en ABM puestos:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

// ✅ Servicio para obtener capas Goya
export const apiGetCapaGoya = async (body: { PuestoId: string; TipoCapaId: string }) => {
  try {
    const response = await api.post("/getCapaGoya", body, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error: any) {
    console.error(
      "Error al obtener capas Goya:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

// ✅ Servicio para obtener zonas Goya
export const apiGetZonaGoya = async (body: { PuestoId: string; TipoCapaId: string; CapaId: string }) => {
  try {
    const response = await api.post("/getzonaGoya", body, {
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  } catch (error: any) {
    console.error(
      "Error al obtener zonas Goya:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

// En tu servicio de permisos:
export const apiCheckPermiso = async (ruta: string, token: string): Promise<boolean> => {
  try {
    const response = await api.post(
      "/permisos",
      { ruta },
      {
        headers: {
          // Content-Type ya lo pone la instancia
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return !!response.data?.permitido;
  } catch (error) {
    console.error("Error al chequear permisos:", error);
    return false;
  }
};

// =====================
// ✅ Servicio: Listado de usuarios (POST /usuarios)
// Mismo formato que apiValidarPermiso, sin tipos adicionales
// =====================
export const apiUsuarios = async (
  payload: any,
  opts?: { signal?: AbortSignal },
) => {
  try {
    const res = await api.post("/usuarios", payload, {
      signal: opts?.signal,
      withCredentials: true,
    });
    return res.data;
  } catch (error: any) {
    const status = error?.response?.status;

    if (status === 401) {
      try {
        clearSentryUser();
      } catch {}
      try {
        if (typeof window !== "undefined") {
          localStorage.removeItem("user");
          localStorage.removeItem("token");
        }
        if (typeof document !== "undefined") {
          document.cookie = "token=; path=/; max-age=0";
        }
      } catch {}
      const e = new Error("UNAUTHORIZED");
      (e as any).status = 401;
      throw e;
    }

    if (status === 403) {
      return error?.response?.data || { reason: "FORBIDDEN" };
    }

    throw error;
  }
};