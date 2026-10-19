const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Quando empacotado com pkg, o config.json fica ao lado do .exe
const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const config = JSON.parse(
  fs.readFileSync(path.join(baseDir, 'config.json'), 'utf8')
);

// Se não for o processo "filho", reabre a si mesmo sem janela e encerra
if (!process.env.LEMBRETE_FILHO) {
  const args = process.pkg ? [] : [__filename];
  const filho = spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, LEMBRETE_FILHO: '1' },
  });
  filho.unref();
  process.exit(0);
}

const debug = !!process.env.LEMBRETE_FILHO;
const log = (...msg) => {
  if (debug) console.log(new Date().toLocaleTimeString(), ...msg);
};

function executar(comando, args, env) {
  return new Promise((resolve, reject) => {
    execFile(comando, args, { env: { ...process.env, ...env }, windowsHide: true },
      (err, stdout) => (err ? reject(err) : resolve(stdout)));
  });
}

async function estaJogando() {
  const saida = await executar('tasklist', ['/FO', 'CSV', '/NH']);
  const processos = saida
    .split('\n')
    .map(linha => linha.split(',')[0].replace(/"/g, '').trim().toLowerCase());
  return config.jogos.some(jogo => processos.includes(jogo.toLowerCase()));
}

async function segundosSemUsar() {
  const script = `
    Add-Type @"
    using System;
    using System.Runtime.InteropServices;
    public class IdleTime {
      [StructLayout(LayoutKind.Sequential)]
      public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
      [DllImport("user32.dll")]
      public static extern bool GetLastInputInfo(ref LASTINPUTINFO p);
      public static uint Get() {
        LASTINPUTINFO l = new LASTINPUTINFO();
        l.cbSize = (uint)Marshal.SizeOf(l);
        GetLastInputInfo(ref l);
        return ((uint)Environment.TickCount - l.dwTime) / 1000;
      }
    }
"@
    [IdleTime]::Get()
  `;
  const saida = await executar('powershell', ['-NoProfile', '-Command', script]);
  return parseInt(saida.trim(), 10);
}

function notificar(texto) {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $n = New-Object System.Windows.Forms.NotifyIcon
    $n.Icon = [System.Drawing.SystemIcons]::Information
    $n.Visible = $true
    $n.ShowBalloonTip(8000, 'Lembrete', $env:MSG, 'Info')
    Start-Sleep -Seconds 9
    $n.Dispose()
  `;
  executar('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', script],
    { MSG: texto }).catch(() => {});
}

let proximo = 0;

async function verificar() {
  try {
    if (await estaJogando()) {
      log('jogando, pulando lembrete');
      return;
    }

    const ociosidade = await segundosSemUsar();
    if (ociosidade > config.ausenciaMaxMinutos * 60) {
      log(`ausente há ${ociosidade}s, pulando lembrete`);
      return;
    }

    const texto = config.lembretes[proximo % config.lembretes.length];
    proximo++;
    notificar(texto);
    log('lembrete:', texto);
  } catch (err) {
    log('erro:', err.message);
  }
}

log(`Lembretes a cada ${config.intervaloMinutos} min. Ctrl+C para parar.`);
setInterval(verificar, config.intervaloMinutos * 60 * 1000);
