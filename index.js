const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')
);

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
    { MSG: texto }).catch(err => console.error('Erro na notificação:', err.message));
}

let proximo = 0;

async function verificar() {
  try {
    if (await estaJogando()) {
      console.log(new Date().toLocaleTimeString(), 'jogando, pulando lembrete');
      return;
    }

    const ociosidade = await segundosSemUsar();
    if (ociosidade > config.ausenciaMaxMinutos * 60) {
      console.log(new Date().toLocaleTimeString(), 'ausente, pulando lembrete');
      return;
    }

    const texto = config.lembretes[proximo % config.lembretes.length];
    proximo++;
    notificar(texto);
    console.log(new Date().toLocaleTimeString(), 'lembrete:', texto);
  } catch (err) {
    console.error('Erro:', err.message);
  }
}

console.log(`Lembretes a cada ${config.intervaloMinutos} min. Ctrl+C para parar.`);
setInterval(verificar, config.intervaloMinutos * 60 * 1000);
