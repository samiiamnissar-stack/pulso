# Topología de Pulso en Packet Tracer

Fichero: `pulso.pkt` (Packet Tracer 8.2 o superior).

Es una versión a escala de la red de la memoria. Se mantiene todo lo que importa para el diseño (dos operadores, todo duplicado, VLAN por función y cortafuegos con reglas), pero con menos servidores de cada tipo: por ejemplo, 2 nodos API representan los 14 del cálculo.

## Dispositivos

| Zona | Dispositivo | Modelo |
|---|---|---|
| Internet | R-INTERNET, SW-USUARIOS, PC-USUARIO, PORTATIL-USUARIO, DNS-PUBLICO | 2911, 2960, PC, Laptop, Server |
| Operadores | ISP-A, ISP-B | 2911 |
| Borde | R-BORDE-1, R-BORDE-2 | 2911 |
| Cortafuegos | FW-1, FW-2 | 2911 con listas de acceso |
| Núcleo | CORE-1, CORE-2 | 3560-24PS (switch de capa 3) |
| Acceso | SW-DMZ, SW-APP, SW-DATOS, SW-GESTION | 2960-24TT |
| Servidores | LB-1, LB-2, API-1, API-2, RT-1, PG-PRIMARIO, PG-STANDBY, PG-REPLICA, REDIS, BASTION, COPIAS, MONITOR, DNS-NTP | Server |

## Cableado

| Desde | Puerto | Hasta | Puerto | Cable |
|---|---|---|---|---|
| R-INTERNET | G0/0 | SW-USUARIOS | F0/1 | Directo |
| R-INTERNET | G0/1 | ISP-A | G0/1 | Directo |
| R-INTERNET | G0/2 | ISP-B | G0/1 | Directo |
| ISP-A | G0/0 | R-BORDE-1 | G0/0 | Directo |
| ISP-B | G0/0 | R-BORDE-2 | G0/0 | Directo |
| R-BORDE-1 | G0/2 | R-BORDE-2 | G0/2 | Directo |
| R-BORDE-1 | G0/1 | FW-1 | G0/0 | Directo |
| R-BORDE-2 | G0/1 | FW-2 | G0/0 | Directo |
| FW-1 | G0/2 | FW-2 | G0/2 | Directo |
| FW-1 | G0/1 | CORE-1 | G0/1 | Directo |
| FW-2 | G0/1 | CORE-2 | G0/1 | Directo |
| CORE-1 | F0/23 y F0/24 | CORE-2 | F0/23 y F0/24 | Cruzado (x2) |
| CORE-1 | F0/1, F0/2, F0/3, F0/4 | SW-DMZ, SW-GESTION, SW-APP, SW-DATOS | G0/1 | Directo |
| CORE-2 | F0/1, F0/2, F0/3, F0/4 | SW-DMZ, SW-GESTION, SW-APP, SW-DATOS | G0/2 | Directo |
| SW-USUARIOS | F0/2, F0/3, F0/4 | PC-USUARIO, PORTATIL-USUARIO, DNS-PUBLICO | Fa0 | Directo |
| SW-DMZ | F0/1, F0/2 | LB-1, LB-2 | Fa0 | Directo |
| SW-APP | F0/1, F0/2, F0/3 | API-1, API-2, RT-1 | Fa0 | Directo |
| SW-DATOS | F0/1, F0/2, F0/3, F0/4 | PG-PRIMARIO, PG-STANDBY, PG-REPLICA, REDIS | Fa0 | Directo |
| SW-GESTION | F0/1 a F0/4 | BASTION, COPIAS, MONITOR, DNS-NTP | Fa0 | Directo |

## Direcciones

| Red | Uso | Puerta de enlace |
|---|---|---|
| 198.51.100.0/24 | Usuarios en Internet | 198.51.100.1 |
| 100.64.1.0/30 y 100.64.2.0/30 | Internet ↔ operadores | |
| 203.0.113.0/30 y 203.0.113.4/30 | Operadores ↔ routers de borde | |
| 10.0.0.0/30 | Borde 1 ↔ Borde 2 | |
| 10.0.1.0/30 y 10.0.2.0/30 | Borde ↔ cortafuegos | |
| 10.0.3.0/30 | FW-1 ↔ FW-2 | |
| 10.0.11.0/30 y 10.0.12.0/30 | Cortafuegos ↔ núcleo | |
| 10.10.X.0/24 (X = número de VLAN) | VLAN 10 a 90 | 10.10.X.1 (compartida por CORE-1 y CORE-2) |

| Equipo | IP | Máscara | Puerta de enlace | DNS |
|---|---|---|---|---|
| PC-USUARIO | 198.51.100.10 | 255.255.255.0 | 198.51.100.1 | 198.51.100.53 |
| PORTATIL-USUARIO | 198.51.100.11 | 255.255.255.0 | 198.51.100.1 | 198.51.100.53 |
| DNS-PUBLICO | 198.51.100.53 | 255.255.255.0 | 198.51.100.1 | |
| LB-1 / LB-2 | 10.10.70.11 / .12 | 255.255.255.0 | 10.10.70.1 | |
| API-1 / API-2 | 10.10.20.11 / .12 | 255.255.255.0 | 10.10.20.1 | |
| RT-1 | 10.10.30.11 | 255.255.255.0 | 10.10.30.1 | |
| PG-PRIMARIO / PG-STANDBY / PG-REPLICA | 10.10.40.11 / .12 / .21 | 255.255.255.0 | 10.10.40.1 | |
| REDIS | 10.10.50.11 | 255.255.255.0 | 10.10.50.1 | |
| BASTION | 10.10.10.11 | 255.255.255.0 | 10.10.10.1 | |
| COPIAS | 10.10.60.11 | 255.255.255.0 | 10.10.60.1 | |
| MONITOR | 10.10.80.11 | 255.255.255.0 | 10.10.80.1 | |
| DNS-NTP | 10.10.90.11 | 255.255.255.0 | 10.10.90.1 | |

En DNS-PUBLICO, servicio DNS activado con el registro `pulso.app → 10.10.70.11`. En LB-1 y LB-2, servicio HTTP activado.

## Configuración

Cada fichero `NN-NOMBRE.txt` se pega entero en la pestaña CLI de su equipo (después de responder `no` a la pregunta del asistente inicial).

## Pruebas

1. Desde PC-USUARIO, en el navegador: `http://pulso.app` → abre la página de LB-1.
2. `ping 10.10.70.11` desde PC-USUARIO → responde (los balanceadores son accesibles).
3. `ping 10.10.40.11` desde PC-USUARIO → no responde (la base de datos no es accesible desde Internet).
4. Apagar el enlace ISP-A ↔ R-BORDE-1 (o FW-1) → el navegador sigue funcionando por el otro camino.
5. En CORE-1: `show standby brief` → CORE-1 activo y CORE-2 en reserva para cada VLAN.
