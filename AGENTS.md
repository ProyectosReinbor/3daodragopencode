# Instrucciones de trabajo del proyecto

## Commits y publicación en GitHub

Por instrucción expresa del propietario, después de cada cambio completo y verificable:

1. Revisar el diff y ejecutar las comprobaciones apropiadas para el cambio.
2. Crear un commit con un mensaje que resuma claramente lo que cambió y su propósito.
3. Subir el commit a GitHub mediante `git push` al remoto y la rama correspondientes. Esta instrucción autoriza estos commits y pushes sin pedir confirmación nuevamente.
4. Confirmar el resultado e informar brevemente al usuario, incluyendo el commit publicado.

Agrupar las ediciones necesarias para una misma mejora en un cambio coherente; no publicar estados incompletos ni cambios con comprobaciones pendientes o fallidas.

Antes de incluir archivos, revisar que no contengan contraseñas, tokens, archivos `.env`, bases de datos, datos personales de usuarios, dependencias ni artefactos de compilación. Respetar `.gitignore` y conservar los cambios del usuario.

Si la rama remota tiene cambios nuevos, revisarlos e integrarlos de forma segura antes de publicar. No usar force push ni descartar trabajo local o remoto. Si la autenticación, la red o un conflicto impiden subir los cambios, conservar el trabajo y comunicar el impedimento; nunca afirmar que se publicó sin verificarlo.
