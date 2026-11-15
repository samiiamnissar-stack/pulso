"""Memoria de cálculo de Pulso. Ejecutar: python3 docs/calculos.py
Todas las cifras de la memoria salen de aquí, para poder rehacerlas si cambia una hipótesis."""
import math, json

# --- T1 · Población objetivo -------------------------------------------------
# INE, Estadística Continua de Población, tabla 56934, población residente a 1/1/2025
poblacion = {18: 541048, 19: 539336, 20: 542720, 21: 541011, 22: 530297, 23: 534266,
             24: 545337, 25: 538328, 26: 530132, 27: 542646, 28: 540956, 29: 545909, 30: 554625}
pob_17 = 534300
pob_18_30 = sum(poblacion.values())
uso_internet = 0.99          # INE TIC 2025: 16-24 años 99,5 % (H) y 99,8 % (M); 25-34 años ≥ 98,7 %
usuarios_internet = pob_18_30 * uso_internet
penetracion = 0.30
mau = usuarios_internet * penetracion            # fórmula del enunciado: MAU = público objetivo × penetración
cuentas = mau / 0.60                             # hipótesis: el 60 % de las cuentas está activa en el mes

# --- T2 · Recurrencia ---------------------------------------------------------
dau_mau = 0.35
dau = mau * dau_mau
sesiones_dia = 4
min_sesion = 6
min_dia = sesiones_dia * min_sesion

# --- T3 · Concurrencia -------------------------------------------------------
conc_media = dau * min_dia / 1440
pct_hora_punta = 0.15
sesiones_dia_total = dau * sesiones_dia
sesiones_punta = sesiones_dia_total * pct_hora_punta
conc_pico = sesiones_punta * min_sesion / 60

# --- T4 · Carga --------------------------------------------------------------
pet_usuario = 0.3
rps = conc_pico * pet_usuario
kb_respuesta = 15            # medido 4,5 kB con 12 locales; con ~50 locales por ciudad se estima 15 kB
mbps = rps * kb_respuesta * 8 / 1000
mbps_margen = mbps * 1.3
pct_escrituras = 0.10
escrituras = rps * pct_escrituras

# --- T5 · Dimensionado -------------------------------------------------------
cap_nodo = 1500              # pet/s por nodo de 16 vCPU (rango del enunciado 1000-2000; laboratorio: 2.800 pet/s con 1 vCPU)
uso_objetivo = 0.70
nodos_api = math.ceil(rps / (cap_nodo * uso_objetivo))
nodos_api_total = nodos_api + 1
conex_por_nodo_rt = 10000
nodos_rt = math.ceil(conc_pico / conex_por_nodo_rt) + 1

# --- Escenarios --------------------------------------------------------------
def escenario(nombre, dau_mau_, pct_punta, pet_u, factor_dia=1.0):
    d = mau * dau_mau_ * factor_dia
    pico = d * sesiones_dia * pct_punta * min_sesion / 60
    r = pico * pet_u
    n = math.ceil(r / (cap_nodo * uso_objetivo)) + 1
    return dict(escenario=nombre, dau=round(d), conc_pico=round(pico), rps=round(r),
                mbps=round(r * kb_respuesta * 8 / 1000), nodos_api=n)

escenarios = [
    escenario('Prudente', 0.30, 0.10, 0.2),
    escenario('Esperado', 0.35, 0.15, 0.3),
    escenario('Sábado noche', 0.35, 0.20, 0.4, factor_dia=1.5),
]

# --- Almacenamiento (a 3 años) ------------------------------------------------
gb = lambda b: b / 1e9
alm = {
    'usuarios (1 kB/cuenta)': gb(cuentas * 1_000),
    'check-ins (DAU × 1/día × 200 B × 30 días; luego se anonimizan)': gb(dau * 1 * 200 * 30),
    'agregados anónimos de ambiente (por local y hora, 3 años)': gb(20_000 * 24 * 365 * 3 * 300),
    'likes (DAU × 5/día × 60 B × 365 × 3)': gb(dau * 5 * 60 * 365 * 3),
    'mensajes (DAU × 10/día × 250 B × 365 × 3)': gb(dau * 10 * 250 * 365 * 3),
    'fotos de perfil opcionales (40 % cuentas × 2 × 400 kB)': gb(cuentas * 0.4 * 2 * 400_000),
}

out = dict(
    pob_17=pob_17, pob_18_30=pob_18_30, usuarios_internet=round(usuarios_internet), mau=round(mau), cuentas=round(cuentas),
    dau=round(dau), min_dia=min_dia, conc_media=round(conc_media), sesiones_dia_total=round(sesiones_dia_total),
    sesiones_punta=round(sesiones_punta), conc_pico=round(conc_pico), rps=round(rps), mbps=round(mbps),
    mbps_margen=round(mbps_margen), escrituras=round(escrituras), nodos_api=nodos_api, nodos_api_total=nodos_api_total,
    nodos_rt=nodos_rt, escenarios=escenarios, almacenamiento_gb={k: round(v, 1) for k, v in alm.items()},
    almacenamiento_total_gb=round(sum(alm.values()), 1),
)
if __name__ == '__main__':
    print(json.dumps(out, indent=2, ensure_ascii=False))

# --- Curva horaria (reparto de las sesiones de un día de fin de semana) -------
# Forma estimada para una app de ocio nocturno: sube por la tarde, el máximo es
# de 23:00 a 00:00 (cuando se decide a dónde ir) y hay un segundo tramo alto
# de 00:00 a 02:00 (cambios de local).
forma = [14, 9, 6, 3, 1.5, 0.5, 0.3, 0.4, 0.6, 0.7, 0.8, 1, 1.3, 1.5, 1.6, 1.6, 2, 2.6, 3.5, 5.1, 7, 9, 12, 15]
total_forma = sum(forma)
curva = [round(sesiones_dia_total * f / total_forma * min_sesion / 60) for f in forma]
pct_curva = [round(100 * f / total_forma, 1) for f in forma]
if __name__ == '__main__':
    print('curva', list(zip(range(24), pct_curva, curva)))
