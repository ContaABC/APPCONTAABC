"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
  ChangeEvent,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft } from "lucide-react";
import {
  obtenerEmpresas,
  obtenerSucursales,
} from "@/app/consultas/movimientos/actions";
import {
  getEmpresasPermitidas,
  getEmpresaActivaUsuario,
  setEmpresaActivaUsuario,
} from "@/app/actions/accionesEmpresas";
import { validarPeriodoContable } from "@/lib/accounting-validations";
import {
  listarFacturasProveedorParaNota,
  registrarNotaRecibida,
} from "@/app/facturas/notas_recibidas/actions-notas";

interface UserType {
  id: string;
  email?: string;
}

interface Company {
  id: number | string;
  empresa_id?: number | string;
  razon_social?: string;
  nombre_comercial?: string;
  nombre?: string;
}

interface Branch {
  id: number | string;
  empresa_id?: number | string;
  codigo_sucursal?: string;
  nombre?: string;
}

interface FacturaRecibidaItem {
  id: string;
  numero_factura?: string;
  cufe?: string;
  fecha_emision?: string;
  emisor_nombre?: string;
  emisor_nit?: string;
  subtotal?: number;
  impuestos?: number;
  total_factura?: number;
  saldo_pendiente?: number;
}

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function setCookieValue(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=86400; SameSite=Lax`;
}

function getFirstByLocalName(
  parent: Element | Document,
  localName: string
): Element | null {
  const elements = parent.getElementsByTagName("*");
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].localName === localName) {
      return elements[i];
    }
  }
  return null;
}

function getAllByLocalName(
  parent: Element | Document,
  localName: string
): Element[] {
  const elements = parent.getElementsByTagName("*");
  const result: Element[] = [];
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].localName === localName) {
      result.push(elements[i]);
    }
  }
  return result;
}

function getTextValue(
  parent: Element | Document | null,
  localName: string
): string {
  if (!parent) return "";
  const el = getFirstByLocalName(parent, localName);
  return el?.textContent?.trim() || "";
}

function parseProveedorDesdeXml(xmlDoc: Document): {
  nit: string;
  nombre: string;
} {
  const supplierNode = getFirstByLocalName(xmlDoc, "AccountingSupplierParty");
  if (!supplierNode) return { nit: "", nombre: "" };

  const partyNode = getFirstByLocalName(supplierNode, "Party") || supplierNode;
  const partyTaxScheme = getFirstByLocalName(partyNode, "PartyTaxScheme");
  const partyIdent = getFirstByLocalName(partyNode, "PartyIdentification");
  const partyLegal = getFirstByLocalName(partyNode, "PartyLegalEntity");
  const partyName = getFirstByLocalName(partyNode, "PartyName");

  const nit =
    (partyTaxScheme && getTextValue(partyTaxScheme, "CompanyID")) ||
    (partyIdent && getTextValue(partyIdent, "ID")) ||
    getTextValue(partyNode, "CompanyID") ||
    getTextValue(partyNode, "ID") ||
    "";

  const nombre =
    (partyTaxScheme && getTextValue(partyTaxScheme, "RegistrationName")) ||
    (partyLegal && getTextValue(partyLegal, "RegistrationName")) ||
    (partyName && getTextValue(partyName, "Name")) ||
    getTextValue(partyNode, "RegistrationName") ||
    getTextValue(partyNode, "Name") ||
    "";

  return { nit: nit.trim(), nombre: nombre.trim() };
}

function parsearMontoInput(raw: string): number {
  if (!raw) return 0;
  const limpio = raw.replace(/\s/g, "").replace(/\$/g, "").trim();
  if (!limpio) return 0;

  if (limpio.includes(",") && limpio.includes(".")) {
    const sinMiles = limpio.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(sinMiles);
    return Number.isNaN(num) ? 0 : num;
  }

  if (limpio.includes(",")) {
    const sinMiles = limpio.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(sinMiles);
    return Number.isNaN(num) ? 0 : num;
  }

  const num = parseFloat(limpio);
  return Number.isNaN(num) ? 0 : num;
}

function formatearMontoEditable(valor: number): string {
  const num = Number.isNaN(valor) ? 0 : valor;
  const tieneDecimales = Math.abs(num % 1) > 0;
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: tieneDecimales ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function NotasRecibidasContent() {
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [rutaRetorno, setRutaRetorno] = useState<string>("/modulos/proveedores");
  const [tituloRetorno, setTituloRetorno] = useState<string>(
    "Volver a Proveedores"
  );

  const [user, setUser] = useState<UserType | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [facturasRecibidas, setFacturasRecibidas] = useState<
    FacturaRecibidaItem[]
  >([]);

  const companiesRef = useRef<Company[]>([]);
  const branchesRef = useRef<Branch[]>([]);

  useEffect(() => {
    companiesRef.current = companies;
  }, [companies]);

  useEffect(() => {
    branchesRef.current = branches;
  }, [branches]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("empresa_activa") ||
        localStorage.getItem("empresa_id") ||
        ""
      );
    }
    return "";
  });

  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("sucursal_activa") ||
        localStorage.getItem("sucursal_id") ||
        ""
      );
    }
    return "";
  });

  const [facturaRecibidaId, setFacturaRecibidaId] = useState<string>("");

  const [proveedorXml, setProveedorXml] = useState<{
    nit: string;
    nombre: string;
  }>({ nit: "", nombre: "" });

  const [fechaContabilizacion, setFechaContabilizacion] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [validandoPeriodo, setValidandoPeriodo] = useState<boolean>(false);

  const [tipoNota, setTipoNota] = useState<"CREDITO" | "DEBITO">("CREDITO");
  const [numeroNota, setNumeroNota] = useState<string>("");
  const [cude, setCude] = useState<string>("");
  const [fechaEmision, setFechaEmision] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [subtotal, setSubtotal] = useState<string>("0");
  const [impuestos, setImpuestos] = useState<string>("0");
  const [montoTotal, setMontoTotal] = useState<string>("0");
  const [motivo, setMotivo] = useState<string>("");
  const [xmlUrl, setXmlUrl] = useState<string>("");
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [referenciaXmlInfo, setReferenciaXmlInfo] = useState<string>("");

  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [isParsingXml, setIsParsingXml] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const limpiarCamposNota = useCallback(() => {
    setTipoNota("CREDITO");
    setNumeroNota("");
    setCude("");
    setFechaEmision(new Date().toISOString().split("T")[0]);
    setSubtotal("0");
    setImpuestos("0");
    setMontoTotal("0");
    setMotivo("");
    setXmlUrl("");
    setPdfUrl("");
    setReferenciaXmlInfo("");
    setProveedorXml({ nit: "", nombre: "" });
    setFacturaRecibidaId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    const fromParam = searchParams.get("from");
    if (fromParam && fromParam.startsWith("/")) {
      setRutaRetorno(fromParam);
      setTituloRetorno(
        fromParam.startsWith("/modulos/contabilidad")
          ? "Volver a Contabilidad"
          : "Volver a Proveedores"
      );
    }
  }, [searchParams]);

  const formatCOP = (val: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(val || 0);

  const formatDecimalCOP = (val: number) =>
    new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);

  const persistirContexto = useCallback(
    async (empId: string, sucId?: string, actualizarPerfil = false) => {
      if (!empId) return;

      const empEncontrada = companiesRef.current.find(
        (e) => String(e.id || e.empresa_id) === String(empId)
      );
      const nombreEmpresa =
        empEncontrada?.razon_social ||
        empEncontrada?.nombre_comercial ||
        empEncontrada?.nombre ||
        "";

      if (typeof window !== "undefined") {
        localStorage.setItem("empresa_activa", String(empId));
        localStorage.setItem("empresa_id", String(empId));
        if (nombreEmpresa) {
          localStorage.setItem("empresa_activa_nombre", nombreEmpresa);
        }
      }
      setCookieValue("empresa_activa", String(empId));

      if (sucId) {
        const sucEncontrada = branchesRef.current.find(
          (s) => String(s.id) === String(sucId)
        );
        if (typeof window !== "undefined") {
          localStorage.setItem("sucursal_activa", String(sucId));
          localStorage.setItem("sucursal_id", String(sucId));
          if (sucEncontrada?.nombre) {
            localStorage.setItem("sucursal_activa_nombre", sucEncontrada.nombre);
          }
        }
        setCookieValue("sucursal_activa", String(sucId));
      } else if (typeof window !== "undefined") {
        localStorage.removeItem("sucursal_activa");
        localStorage.removeItem("sucursal_id");
        localStorage.removeItem("sucursal_activa_nombre");
        document.cookie = "sucursal_activa=; path=/; max-age=0; SameSite=Lax";
      }

      try {
        await setEmpresaActivaUsuario(empId);
      } catch {
        // Ignorar si no aplica
      }

      if (actualizarPerfil) {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
          if (supabaseUrl && supabaseAnonKey) {
            const client = createClient(supabaseUrl, supabaseAnonKey);
            const {
              data: { user: authUser },
            } = await client.auth.getUser();
            if (authUser) {
              const payloadPerfil: Record<string, unknown> = {
                empresa_activa: Number(empId),
              };
              if (sucId && Number(sucId) > 0) {
                payloadPerfil.sucursal_activa = Number(sucId);
              } else if (sucId === "") {
                payloadPerfil.sucursal_activa = null;
              }
              await client
                .from("usuarios_perfiles")
                .update(payloadPerfil)
                .eq("id", authUser.id);
            }
          }
        } catch (err) {
          console.error("Error al actualizar perfil en Notas Recibidas:", err);
        }
      }
    },
    []
  );

  const verificarPeriodoPorEmpresa = useCallback(
    async (fecha: string, empIdActual: string, sucIdActual?: string) => {
      const empNum = Number(empIdActual);
      if (!empIdActual || Number.isNaN(empNum) || empNum <= 0 || !fecha) {
        setErrorPeriodo(null);
        setValidandoPeriodo(false);
        return;
      }

      setValidandoPeriodo(true);
      setErrorPeriodo(null);

      try {
        const res = await validarPeriodoContable(
          String(empNum),
          sucIdActual || "",
          fecha
        );
        if (!res.valido) {
          setErrorPeriodo(
            res.mensaje ||
              "Periodo no habilitado para transacciones en la empresa seleccionada."
          );
        } else {
          setErrorPeriodo(null);
        }
      } catch (err) {
        console.error("Error al validar periodo contable por empresa:", err);
        setErrorPeriodo(null);
      } finally {
        setValidandoPeriodo(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isMounted || loadingInitial) return;

    if (!selectedCompanyId || !fechaContabilizacion) {
      setErrorPeriodo(null);
      setValidandoPeriodo(false);
      return;
    }

    verificarPeriodoPorEmpresa(
      fechaContabilizacion,
      selectedCompanyId,
      selectedBranchId
    );
  }, [
    isMounted,
    loadingInitial,
    selectedCompanyId,
    selectedBranchId,
    fechaContabilizacion,
    verificarPeriodoPorEmpresa,
  ]);

  const fetchFacturasRecibidas = useCallback(
    async (
      companyId: string,
      proveedorNit?: string,
      refNumero?: string,
      refCufe?: string
    ) => {
      const empNum = Number(companyId);
      if (!companyId || Number.isNaN(empNum) || empNum <= 0) {
        setFacturasRecibidas([]);
        setFacturaRecibidaId("");
        return;
      }

      const resp = await listarFacturasProveedorParaNota(
        empNum,
        proveedorNit || null
      );

      if (!resp.success) {
        console.error("Error al cargar facturas_recibidas:", resp.error);
        setStatusMessage({
          type: "error",
          text: resp.error || "Error al consultar facturas recibidas.",
        });
        setFacturasRecibidas([]);
        setFacturaRecibidaId("");
        return;
      }

      const lista = resp.facturas as FacturaRecibidaItem[];
      setFacturasRecibidas(lista);

      if (refNumero || refCufe) {
        const match = lista.find(
          (f) =>
            (refCufe && f.cufe && f.cufe.trim() === refCufe.trim()) ||
            (refNumero &&
              f.numero_factura &&
              f.numero_factura.trim().toLowerCase() ===
                refNumero.trim().toLowerCase())
        );
        if (match) {
          setFacturaRecibidaId(String(match.id));
          return;
        }
      }

      if (lista.length > 0) {
        setFacturaRecibidaId((prev) =>
          lista.some((f) => String(f.id) === String(prev))
            ? prev
            : String(lista[0].id)
        );
      } else {
        setFacturaRecibidaId("");
      }
    },
    []
  );

  const cargarEmpresasIniciales = useCallback(async () => {
    setLoadingInitial(true);
    setError(null);
    setErrorPeriodo(null);
    try {
      let listaEmpresas: Company[] = [];

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      if (supabaseUrl && supabaseAnonKey) {
        const client = createClient(supabaseUrl, supabaseAnonKey);
        const {
          data: { user: authUser },
        } = await client.auth.getUser();
        if (authUser) {
          setUser({ id: authUser.id, email: authUser.email });
          const { data: permisosTx } = await client
            .from("usuario_permisos_tx")
            .select("empresa_id")
            .eq("usuario_id", authUser.id);

          const idsPermitidos = Array.from(
            new Set(
              (permisosTx || [])
                .map((p: { empresa_id?: string | number | null }) =>
                  p.empresa_id != null ? String(p.empresa_id) : ""
                )
                .filter(Boolean)
            )
          );

          if (idsPermitidos.length > 0) {
            const { data: rowsEmp } = await client
              .from("empresas")
              .select("id, razon_social, nombre_comercial")
              .in("id", idsPermitidos);

            if (rowsEmp && rowsEmp.length > 0) {
              listaEmpresas = rowsEmp as Company[];
            }
          }
        }
      }

      if (listaEmpresas.length === 0) {
        const resPermitidas: unknown = await getEmpresasPermitidas();
        if (Array.isArray(resPermitidas)) {
          listaEmpresas = resPermitidas as Company[];
        } else if (
          resPermitidas &&
          typeof resPermitidas === "object" &&
          Array.isArray((resPermitidas as { datos?: unknown }).datos)
        ) {
          listaEmpresas = (resPermitidas as { datos: Company[] }).datos;
        }
      }

      if (listaEmpresas.length === 0) {
        const res = await obtenerEmpresas();
        if (res.success && Array.isArray(res.data)) {
          listaEmpresas = res.data as Company[];
        }
      }

      if (listaEmpresas.length > 0) {
        const ordenadas = [...listaEmpresas].sort((a, b) => {
          const nomA = a.razon_social || a.nombre_comercial || a.nombre || "";
          const nomB = b.razon_social || b.nombre_comercial || b.nombre || "";
          return nomA.localeCompare(nomB, "es", { sensitivity: "base" });
        });

        setCompanies(ordenadas);

        let empresaActivaBD: string | null = null;
        try {
          const bdVal = await getEmpresaActivaUsuario();
          if (bdVal) empresaActivaBD = String(bdVal);
        } catch {
          // Ignorar
        }

        const localEmp =
          typeof window !== "undefined"
            ? localStorage.getItem("empresa_activa") ||
              localStorage.getItem("empresa_id")
            : null;
        const cookieEmp = getCookieValue("empresa_activa");

        const candidata = localEmp || cookieEmp || empresaActivaBD;
        const existe = ordenadas.some(
          (e) => String(e.id || e.empresa_id) === String(candidata)
        );

        const idFinal =
          existe && candidata
            ? String(candidata)
            : String(ordenadas[0].id || ordenadas[0].empresa_id);

        setSelectedCompanyId(idFinal);
        if (typeof window !== "undefined") {
          localStorage.setItem("empresa_activa", idFinal);
          localStorage.setItem("empresa_id", idFinal);
        }
        setCookieValue("empresa_activa", idFinal);
      } else {
        setCompanies([]);
        setSelectedCompanyId("");
        setErrorPeriodo(null);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar empresas.";
      console.error("Error al cargar empresas en Notas Recibidas:", err);
      setError(msg);
      setErrorPeriodo(null);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    cargarEmpresasIniciales();
  }, [isMounted, cargarEmpresasIniciales]);

  useEffect(() => {
    if (!selectedCompanyId || !isMounted) {
      setBranches([]);
      setSelectedBranchId("");
      setFacturasRecibidas([]);
      setFacturaRecibidaId("");
      setErrorPeriodo(null);
      return;
    }

    let cancelado = false;

    async function cargarSucursalesYFacturas() {
      try {
        const sucRes = await obtenerSucursales(Number(selectedCompanyId));
        if (cancelado) return;

        let sucursalElegidaId = "";

        if (sucRes.success) {
          const listaSuc = (sucRes.data || []) as Branch[];
          setBranches(listaSuc);

          if (listaSuc.length === 1) {
            sucursalElegidaId = String(listaSuc[0].id);
          } else if (listaSuc.length > 1) {
            const sucGuardada =
              (typeof window !== "undefined"
                ? localStorage.getItem("sucursal_activa") ||
                  localStorage.getItem("sucursal_id")
                : null) || getCookieValue("sucursal_activa");

            const coincideGuardada = listaSuc.some(
              (s) => String(s.id) === String(sucGuardada)
            );

            sucursalElegidaId =
              coincideGuardada && sucGuardada
                ? String(sucGuardada)
                : String(listaSuc[0].id);
          }

          setSelectedBranchId(sucursalElegidaId);
        } else {
          setBranches([]);
          setSelectedBranchId("");
        }

        await persistirContexto(
          selectedCompanyId,
          sucursalElegidaId || "",
          true
        );

        if (!cancelado) {
          await fetchFacturasRecibidas(selectedCompanyId);
        }
      } catch (err) {
        console.error("Error al cargar sucursales y facturas:", err);
      }
    }

    cargarSucursalesYFacturas();

    return () => {
      cancelado = true;
    };
  }, [
    selectedCompanyId,
    isMounted,
    persistirContexto,
    fetchFacturasRecibidas,
  ]);

  const handleCambioEmpresa = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaEmpresa = e.target.value;
    setErrorPeriodo(null);
    setStatusMessage(null);
    limpiarCamposNota();
    setSelectedCompanyId(nuevaEmpresa);
    setSelectedBranchId("");

    if (typeof window !== "undefined") {
      localStorage.removeItem("sucursal_activa");
      localStorage.removeItem("sucursal_id");
      localStorage.removeItem("sucursal_activa_nombre");
    }

    if (nuevaEmpresa) {
      await persistirContexto(nuevaEmpresa, "", true);
    } else {
      setBranches([]);
      setFacturasRecibidas([]);
    }
  };

  const handleCambioSucursal = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nuevaSucursal = e.target.value;
    setErrorPeriodo(null);
    setStatusMessage(null);
    limpiarCamposNota();
    setSelectedBranchId(nuevaSucursal);

    if (selectedCompanyId) {
      await persistirContexto(selectedCompanyId, nuevaSucursal || "", true);
      await fetchFacturasRecibidas(selectedCompanyId);
    }
  };

  const handleXmlNotaChange = (e: ChangeEvent<HTMLInputElement>) => {
    setStatusMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xml")) {
      setStatusMessage({
        type: "error",
        text: "Seleccione un archivo XML válido (.xml).",
      });
      return;
    }

    limpiarCamposNota();
    setIsParsingXml(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parser = new DOMParser();
        let xmlDoc = parser.parseFromString(text, "text/xml");

        const attachedDoc = getFirstByLocalName(xmlDoc, "AttachedDocument");
        if (attachedDoc) {
          const desc = getTextValue(attachedDoc, "Description");
          if (desc && desc.includes("<")) {
            xmlDoc = parser.parseFromString(desc, "text/xml");
          }
        }

        const rootName = xmlDoc.documentElement?.localName || "";
        if (rootName.toLowerCase().includes("debitnote")) {
          setTipoNota("DEBITO");
        } else {
          setTipoNota("CREDITO");
        }

        const proveedorExtraido = parseProveedorDesdeXml(xmlDoc);
        setProveedorXml(proveedorExtraido);

        const numNotaXml = getTextValue(xmlDoc, "ID");
        const cudeXml = getTextValue(xmlDoc, "UUID");
        const fechaXml = getTextValue(xmlDoc, "IssueDate");

        const legalTotal =
          getFirstByLocalName(xmlDoc, "LegalMonetaryTotal") ||
          getFirstByLocalName(xmlDoc, "RequestedMonetaryTotal");

        const subVal = legalTotal
          ? parseFloat(
              getTextValue(legalTotal, "LineExtensionAmount") ||
                getTextValue(legalTotal, "TaxExclusiveAmount") ||
                "0"
            )
          : 0;

        const totVal = legalTotal
          ? parseFloat(
              getTextValue(legalTotal, "PayableAmount") ||
                getTextValue(legalTotal, "TaxInclusiveAmount") ||
                "0"
            )
          : 0;

        const taxNodes = getAllByLocalName(xmlDoc, "TaxTotal");
        let impVal = 0;
        taxNodes.forEach((n) => {
          const t = parseFloat(getTextValue(n, "TaxAmount") || "0");
          if (t > 0) impVal += t;
        });

        const notaMsg = getTextValue(xmlDoc, "Note");
        const billingRef = getFirstByLocalName(xmlDoc, "BillingReference");
        const invDocRef = billingRef
          ? getFirstByLocalName(billingRef, "InvoiceDocumentReference")
          : null;
        const refNum = invDocRef ? getTextValue(invDocRef, "ID") : "";
        const refCufe = invDocRef ? getTextValue(invDocRef, "UUID") : "";

        if (numNotaXml) setNumeroNota(numNotaXml);
        if (cudeXml) setCude(cudeXml);
        if (fechaXml) setFechaEmision(fechaXml);
        setSubtotal(formatearMontoEditable(subVal || 0));
        setImpuestos(formatearMontoEditable(impVal || 0));
        setMontoTotal(
          formatearMontoEditable(
            totVal > 0 ? totVal : (subVal || 0) + (impVal || 0)
          )
        );
        if (notaMsg) setMotivo(notaMsg);

        if (refNum || refCufe) {
          setReferenciaXmlInfo(
            `Factura referencia en XML: ${refNum || "S/N"}${
              refCufe ? ` | UUID: ${refCufe.substring(0, 18)}...` : ""
            }`
          );
        }

        if (selectedCompanyId) {
          fetchFacturasRecibidas(
            selectedCompanyId,
            proveedorExtraido.nit,
            refNum,
            refCufe
          );
        }

        setStatusMessage({
          type: "success",
          text: `XML "${file.name}" leído correctamente${
            proveedorExtraido.nit
              ? ` (Proveedor NIT ${proveedorExtraido.nit})`
              : ""
          }. Revise los datos antes de registrar.`,
        });
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Error al interpretar el XML.";
        setStatusMessage({ type: "error", text: msg });
      } finally {
        setIsParsingXml(false);
      }
    };
    reader.readAsText(file);
  };

  // Asiento contable inverso al de notas emitidas (proveedores / compras)
  const asientoContablePreview = useMemo(() => {
    const subNum = parsearMontoInput(subtotal);
    const impNum = parsearMontoInput(impuestos);
    const totNum = parsearMontoInput(montoTotal);
    const totalEfectivo = totNum > 0 ? totNum : subNum + impNum;

    if (tipoNota === "CREDITO") {
      // Nota Crédito recibida: Débito a Proveedores (CxP) / Crédito a Gasto o Costo e IVA
      const lineas: Array<{
        concepto: string;
        debito: number;
        credito: number;
      }> = [
        {
          concepto: "Proveedores / Cuentas por Pagar (Reducción saldo)",
          debito: totalEfectivo,
          credito: 0,
        },
      ];
      if (subNum > 0) {
        lineas.push({
          concepto: "Gasto / Costo / Inventario (Ajuste crédito)",
          debito: 0,
          credito: subNum,
        });
      }
      if (impNum > 0) {
        lineas.push({
          concepto: "IVA Descontable / Impuestos (Ajuste crédito)",
          debito: 0,
          credito: impNum,
        });
      }
      return lineas;
    }

    // Nota Débito recibida: Débito a Gasto o Costo e IVA / Crédito a Proveedores (CxP)
    const lineas: Array<{
      concepto: string;
      debito: number;
      credito: number;
    }> = [];
    if (subNum > 0) {
      lineas.push({
        concepto: "Gasto / Costo / Inventario (Mayor valor débito)",
        debito: subNum,
        credito: 0,
      });
    }
    if (impNum > 0) {
      lineas.push({
        concepto: "IVA Descontable / Impuestos (Mayor valor débito)",
        debito: impNum,
        credito: 0,
      });
    }
    lineas.push({
      concepto: "Proveedores / Cuentas por Pagar (Aumento saldo)",
      debito: 0,
      credito: totalEfectivo,
    });
    return lineas;
  }, [tipoNota, subtotal, impuestos, montoTotal]);

  const handleRegistrarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!selectedCompanyId) {
      setStatusMessage({
        type: "error",
        text: "Debe seleccionar una empresa activa.",
      });
      return;
    }

    if (errorPeriodo) {
      setStatusMessage({
        type: "error",
        text: errorPeriodo,
      });
      return;
    }

    if (!facturaRecibidaId) {
      setStatusMessage({
        type: "error",
        text: "Debe seleccionar la factura de proveedor afectada.",
      });
      return;
    }

    if (!numeroNota.trim()) {
      setStatusMessage({
        type: "error",
        text: "Debe ingresar el número de la nota.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await registrarNotaRecibida({
        empresaId: selectedCompanyId,
        sucursalId: selectedBranchId || null,
        usuarioId: user?.id || null,
        facturaRecibidaId,
        tipoNota,
        numeroNota: numeroNota.trim(),
        cude: cude.trim(),
        fechaEmision,
        fechaContable: fechaContabilizacion,
        subtotal: parsearMontoInput(subtotal),
        impuestos: parsearMontoInput(impuestos),
        montoTotal: parsearMontoInput(montoTotal),
        motivo: motivo.trim() || undefined,
        xmlUrl: xmlUrl.trim() || undefined,
        pdfUrl: pdfUrl.trim() || undefined,
      });

      if (!res.success) {
        throw new Error(res.error || "No se pudo registrar la nota.");
      }

      setStatusMessage({
        type: "success",
        text: `Nota ${tipoNota} N° ${numeroNota.trim()} registrada, asiento contable aplicado y saldo de factura actualizado.`,
      });

      limpiarCamposNota();
      await fetchFacturasRecibidas(selectedCompanyId);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error al registrar la nota.";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isMounted || loadingInitial) {
    return (
      <div className="max-w-7xl mx-auto p-6 text-center text-sm font-medium text-gray-500">
        Cargando interfaz...
      </div>
    );
  }

  const facturaSeleccionada = facturasRecibidas.find(
    (f) => String(f.id) === String(facturaRecibidaId)
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 text-sm">
      {/* Encabezado */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={rutaRetorno}
            title={tituloRetorno}
            className="p-2.5 text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl transition flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              Notas Crédito / Débito de Proveedores
            </h1>
            <p className="text-xs md:text-sm text-gray-500">
              Facturas Recibidas &amp; Ajuste Contable (Asiento Inverso a Notas Emitidas)
            </p>
          </div>
        </div>
        {user && (
          <div className="text-xs text-gray-500">
            Usuario:{" "}
            <span className="font-semibold text-gray-700">{user.email}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-md text-xs md:text-sm">
          {error}
        </div>
      )}

      {/* Selectores Parámetros */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200 items-start">
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Empresa *
          </label>
          <select
            value={selectedCompanyId}
            onChange={handleCambioEmpresa}
            disabled={!isMounted || loadingInitial || companies.length <= 1}
            suppressHydrationWarning
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-100"
          >
            {!isMounted || loadingInitial ? (
              <option value="">Cargando empresas...</option>
            ) : companies.length === 0 ? (
              <option value="">Sin empresas asignadas</option>
            ) : (
              <>
                {companies.length !== 1 && (
                  <option value="">-- Seleccione Empresa --</option>
                )}
                {companies.map((emp) => {
                  const id = String(emp.id || emp.empresa_id);
                  return (
                    <option key={id} value={id}>
                      {emp.razon_social || emp.nombre_comercial || emp.nombre}
                    </option>
                  );
                })}
              </>
            )}
          </select>
        </div>

        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Sucursal
          </label>
          <select
            value={selectedBranchId}
            onChange={handleCambioSucursal}
            disabled={!isMounted || !selectedCompanyId || branches.length === 0}
            suppressHydrationWarning
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-100"
          >
            {branches.length === 0 ? (
              <option value="">-- Sin sucursales disponibles --</option>
            ) : (
              branches.map((b) => (
                <option key={String(b.id)} value={String(b.id)}>
                  {b.nombre}
                  {b.codigo_sucursal ? ` (${b.codigo_sucursal})` : ""}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Factura Proveedor Afectada *
          </label>
          <select
            value={facturaRecibidaId}
            onChange={(e) => setFacturaRecibidaId(e.target.value)}
            disabled={
              !isMounted || !selectedCompanyId || facturasRecibidas.length === 0
            }
            suppressHydrationWarning
            className="w-full bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="">
              {facturasRecibidas.length === 0
                ? proveedorXml.nit
                  ? `Sin facturas para NIT ${proveedorXml.nit}`
                  : "Sin facturas recibidas"
                : "-- Seleccione factura --"}
            </option>
            {facturasRecibidas.map((f) => (
              <option key={String(f.id)} value={String(f.id)}>
                {`${f.numero_factura || "S/N"} — ${
                  f.emisor_nombre || "Proveedor"
                } (Saldo: ${formatCOP(
                  Number(f.saldo_pendiente ?? f.total_factura ?? 0)
                )})`}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Fecha Contabilidad *
          </label>
          <input
            type="date"
            value={fechaContabilizacion}
            disabled={!isMounted || !selectedCompanyId}
            onChange={(e) => {
              const nuevaFecha = e.target.value;
              setFechaContabilizacion(nuevaFecha);
              setErrorPeriodo(null);
            }}
            onBlur={() => {
              if (selectedCompanyId && fechaContabilizacion) {
                verificarPeriodoPorEmpresa(
                  fechaContabilizacion,
                  selectedCompanyId,
                  selectedBranchId
                );
              }
            }}
            className="w-full bg-white border border-gray-300 rounded-md px-2.5 py-1.5 text-xs md:text-sm text-gray-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:bg-gray-100"
          />
          {selectedCompanyId && validandoPeriodo && (
            <p className="text-xs text-blue-500 mt-1 animate-pulse">
              Verificando...
            </p>
          )}
          {selectedCompanyId && errorPeriodo && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-1.5 rounded mt-1">
              ⚠️ {errorPeriodo}
            </p>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`px-4 py-2.5 rounded-md text-xs md:text-sm font-medium ${
            statusMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {selectedCompanyId && errorPeriodo ? (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs md:text-sm font-semibold">
          🛑 No es posible registrar notas porque el periodo contable
          seleccionado no se encuentra habilitado o está cerrado para la
          empresa activa.
        </div>
      ) : (
        <form
          onSubmit={handleRegistrarNota}
          className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 md:p-6 space-y-4"
        >
          {/* Carga rápida desde XML */}
          <div className="bg-blue-50/50 border border-dashed border-blue-200 rounded-lg p-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-xs md:text-sm font-bold text-blue-900 whitespace-nowrap">
                Cargar XML de Nota:
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                onChange={handleXmlNotaChange}
                disabled={isParsingXml || !selectedCompanyId}
                className="block w-full text-xs md:text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-800 hover:file:bg-blue-200 cursor-pointer disabled:opacity-50"
              />
            </div>
            <div className="flex flex-col items-end gap-1">
              {proveedorXml.nit && (
                <span className="text-xs font-mono text-gray-700 bg-white px-2.5 py-1 rounded border border-gray-200">
                  Proveedor XML: {proveedorXml.nombre || "Sin Nombre"} (NIT{" "}
                  {proveedorXml.nit})
                </span>
              )}
              {referenciaXmlInfo && (
                <span className="text-xs font-mono text-blue-800 bg-white px-2.5 py-1 rounded border border-blue-200">
                  {referenciaXmlInfo}
                </span>
              )}
            </div>
          </div>

          {facturaSeleccionada && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs md:text-sm">
              <div>
                <span className="text-xs text-gray-500 uppercase block">
                  Factura Seleccionada
                </span>
                <span className="font-bold text-gray-800">
                  {facturaSeleccionada.numero_factura || "S/N"}
                </span>
                <span className="text-xs text-gray-500 block">
                  Emisión: {facturaSeleccionada.fecha_emision || "-"}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 uppercase block">
                  Proveedor
                </span>
                <span className="font-semibold text-gray-800 truncate block">
                  {facturaSeleccionada.emisor_nombre || "Sin Nombre"}
                </span>
                <span className="text-xs font-mono text-gray-500 block">
                  NIT: {facturaSeleccionada.emisor_nit || "-"}
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-gray-500 uppercase block font-sans">
                  Total Factura
                </span>
                <span>
                  {formatCOP(Number(facturaSeleccionada.total_factura || 0))}
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-gray-500 uppercase block font-sans">
                  Saldo Pendiente
                </span>
                <span className="font-bold text-blue-900">
                  {formatCOP(
                    Number(
                      facturaSeleccionada.saldo_pendiente ??
                        facturaSeleccionada.total_factura ??
                        0
                    )
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Campos de la nota */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Tipo de Nota *
              </label>
              <select
                value={tipoNota}
                onChange={(e) =>
                  setTipoNota(
                    e.target.value === "DEBITO" ? "DEBITO" : "CREDITO"
                  )
                }
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm bg-white"
              >
                <option value="CREDITO">Nota Crédito (CREDITO)</option>
                <option value="DEBITO">Nota Débito (DEBITO)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Número de Nota *
              </label>
              <input
                type="text"
                value={numeroNota}
                onChange={(e) => setNumeroNota(e.target.value)}
                placeholder="Ej: NC-001"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Fecha Emisión Nota *
              </label>
              <input
                type="date"
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                CUDE (DIAN)
              </label>
              <input
                type="text"
                value={cude}
                onChange={(e) => setCude(e.target.value)}
                placeholder="Código único electrónico"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Subtotal *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                onBlur={() =>
                  setSubtotal(formatearMontoEditable(parsearMontoInput(subtotal)))
                }
                placeholder="0"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm font-mono text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Impuestos (IVA) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={impuestos}
                onChange={(e) => setImpuestos(e.target.value)}
                onBlur={() =>
                  setImpuestos(formatearMontoEditable(parsearMontoInput(impuestos)))
                }
                placeholder="0"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm font-mono text-right"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Monto Total *
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={montoTotal}
                onChange={(e) => setMontoTotal(e.target.value)}
                onBlur={() =>
                  setMontoTotal(formatearMontoEditable(parsearMontoInput(montoTotal)))
                }
                placeholder="0"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm font-mono font-bold text-right"
              />
            </div>
          </div>

          {/* Vista previa del asiento contable inverso */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase">
                Asiento Contable Proyectado ({tipoNota} Proveedor)
              </span>
              <span className="text-[11px] text-slate-500">
                Sentido inverso a notas emitidas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-1.5 pr-3">Concepto / Cuenta</th>
                    <th className="py-1.5 px-3 text-right">Débito</th>
                    <th className="py-1.5 pl-3 text-right">Crédito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 font-mono">
                  {asientoContablePreview.map((fila, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 pr-3 font-sans text-slate-700">
                        {fila.concepto}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-800">
                        {fila.debito > 0 ? `$${formatDecimalCOP(fila.debito)}` : "-"}
                      </td>
                      <td className="py-1.5 pl-3 text-right text-slate-800">
                        {fila.credito > 0 ? `$${formatDecimalCOP(fila.credito)}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                Motivo / Concepto
              </label>
              <input
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: Devolución / Descuento / Ajuste"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                URL XML (opcional)
              </label>
              <input
                type="text"
                value={xmlUrl}
                onChange={(e) => setXmlUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                URL PDF (opcional)
              </label>
              <input
                type="text"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="https://..."
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-xs md:text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-100">
            <button
              type="submit"
              disabled={
                isSaving ||
                !selectedCompanyId ||
                !facturaRecibidaId ||
                Boolean(errorPeriodo)
              }
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-md text-xs md:text-sm disabled:bg-blue-300 transition-colors cursor-pointer"
            >
              {isSaving ? "Registrando Nota..." : "Registrar y Aplicar Nota"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function NotasRecibidasPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto p-6 text-center text-sm font-medium text-gray-500">
          Cargando interfaz...
        </div>
      }
    >
      <NotasRecibidasContent />
    </Suspense>
  );
}