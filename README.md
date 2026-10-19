# nao-trabalhe-demais

Lembretes de saúde para o computador (beber água, levantar, descansar a vista). Não aparecem enquanto você está jogando (War Thunder, Wardogs) nem quando você está ausente.

## Requisitos

- Windows 10 ou superior
- Node.js (testado com v24)

## Uso

```
node index.js
```

Edite `config.json` para mudar o intervalo, o tempo de ausência considerado e a lista de processos de jogos.

## Iniciar com o Windows

1. Win+R, digite `shell:startup` e Enter.
2. Crie `lembrete.vbs` nessa pasta com:

```vbs
Set shell = CreateObject("WScript.Shell")
shell.Run "node C:\caminho\para\nao-trabalhe-demais\index.js", 0, False
```
