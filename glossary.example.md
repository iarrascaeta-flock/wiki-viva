# Glosario (ejemplo)

Glosario de ejemplo con datos ficticios, para correr la app sin acceso al repo privado de datos. El glosario real vive en `GLOSSARY_REPO`.

## Orden de compra
**Siglas / sinónimos:** OC, Pedido
**Definición:** Documento que registra lo que un cliente compra, con sus ítems, cantidades y precios acordados.
**Casos especiales:** Una OC confirmada no se puede editar: los cambios se hacen con una nota de ajuste.
**Fuentes:** ABC-101, ABC-102

## Nota de ajuste
**Siglas / sinónimos:** NA
**Definición:** Documento que corrige una orden de compra confirmada sumando o restando ítems o importes.
**Casos especiales:** Si el ajuste deja el total en negativo, se registra como devolución.
**Fuentes:** ABC-102, ABC-110

## Estado de la orden
**Siglas / sinónimos:** Estado OC
**Definición:** Etapa en la que está una orden de compra: 1 = Borrador, 2 = Confirmada, 3 = Facturada.
**Casos especiales:** Solo las órdenes en estado 1 se pueden editar.
**Fuentes:** ABC-101, ABC-115

## Cliente mayorista
**Siglas / sinónimos:** Mayorista
**Definición:** Cliente que compra por volumen y tiene una lista de precios propia.
**Casos especiales:** Las órdenes de mayoristas por encima del límite de crédito quedan pendientes de aprobación.
**Fuentes:** ABC-120

## Límite de crédito
**Siglas / sinónimos:** LC
**Definición:** Monto máximo de deuda que un cliente puede tener abierta al confirmar una orden.
**Fuentes:** ABC-120, ABC-121
