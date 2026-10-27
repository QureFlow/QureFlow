"""Execute real CLI checks in a native console and capture that console window."""
import ctypes as C
from ctypes import wintypes as W
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from PIL import ImageGrab

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'tmp/report/evidence'
K = C.windll.kernel32
U = C.windll.user32
K.GetConsoleWindow.restype = W.HWND
K.GetStdHandle.restype = W.HANDLE

class Coord(C.Structure):
    _fields_ = [('X', C.c_short), ('Y', C.c_short)]
class Rect(C.Structure):
    _fields_ = [('Left', C.c_short), ('Top', C.c_short), ('Right', C.c_short), ('Bottom', C.c_short)]
class Font(C.Structure):
    _fields_ = [('cbSize', W.ULONG), ('nFont', W.DWORD), ('dwFontSize', Coord),
                ('FontFamily', W.UINT), ('FontWeight', W.UINT), ('FaceName', W.WCHAR * 32)]

def execute(group):
    data = json.loads((OUT / 'report-data.json').read_text(encoding='utf8'))
    if group == 'tests' and (OUT / 'terminal-tests.txt').exists():
        command = "Get-Content tmp/report/evidence/terminal-tests.txt -Encoding UTF8 -Tail 12"
        result = subprocess.run(['powershell','-NoProfile','-Command',
                                '[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); '+command], cwd=ROOT,
                                capture_output=True, text=True, encoding='utf8')
        return 'PS> ' + command + '\n\n' + result.stdout
    if group == 'tests':
        args = [r'C:/Users/ASUS/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe',
                '--import', 'tsx', '--test', '--test-reporter=spec', 'tests/mysql.test.ts']
        result = subprocess.run(args, cwd=ROOT/'backend', capture_output=True, text=True, encoding='utf8')
        text = '> node --import tsx --test --test-reporter=spec tests/mysql.test.ts\n\n' + result.stdout + result.stderr
        if result.returncode:
            raise RuntimeError(text)
    else:
        sql = data['sql'][group]['sql'] if group in data['sql'] else ''
        if group == 'function':
            sql = "SELECT fn_consultation_minutes('2026-10-19 10:00:00',\n '2026-10-19 10:12:30') AS minutes,\n fn_consultation_minutes(NULL,'2026-10-19 10:12:30') AS missingInput,\n fn_consultation_minutes('2026-10-19 11:00:00',\n '2026-10-19 10:00:00') AS reversedInput;"
        if group == 'directory':
            sql = "SELECT d.name, s.name AS specialty, d.consultationFee AS fee\nFROM doctors d JOIN specialties s ON s.id=d.specialtyId\nWHERE s.name='Gynecology' AND d.status='active'\nORDER BY d.consultationFee,d.name;"
        if group == 'booking':
            sql = "SELECT a.date, a.tokenNumber, a.status AS appointmentStatus,\n t.status AS tokenStatus, s.bookedCount\nFROM appointments a\nJOIN queue_tokens t ON t.appointmentId=a.id\nJOIN appointment_slots s ON s.doctorId=a.doctorId\n AND s.slotDate=a.date AND s.slotMinute=a.slotMinute\nWHERE a.id='apt-7fb41770-fa6a-4da3-a025-33261330f765';"
        if group == 'schema':
            sql = "SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion;\nSELECT 'doctors' AS entity, COUNT(*) AS total FROM doctors\nUNION ALL SELECT 'appointments',COUNT(*) FROM appointments\nUNION ALL SELECT 'queue_tokens',COUNT(*) FROM queue_tokens;"
        if group == 'cursor':
            sql = sql.rstrip(';') + '\\G'
        args = ['docker', 'exec', '-i', '-e', 'MYSQL_PWD=qureflow_local_only',
                'qureflow-dbms-mysql-1', 'mysql', '-uqureflow', 'qureflow_dbms', '--table', '--verbose']
        result = subprocess.run(args, input=sql, capture_output=True, text=True, encoding='utf8')
        text = result.stdout + result.stderr
        if result.returncode:
            raise RuntimeError(text)
        (OUT / ('terminal-' + group + '.sql')).write_text(sql, encoding='utf8')
    (OUT / ('terminal-' + group + '.txt')).write_text(text, encoding='utf8')
    return text

def capture(group):
    text = execute(group)
    # Real command output is printed unchanged. Only console window geometry is set.
    cols = 100
    lines = sum(max(1, (len(line)+cols-1)//cols) for line in text.splitlines()) + 4
    rows = min(32, max(16, lines))
    hwnd = K.GetConsoleWindow()
    handle = K.GetStdHandle(-11)
    font = Font(); font.cbSize = C.sizeof(Font); font.dwFontSize = Coord(0,20)
    font.FontFamily = 54; font.FontWeight = 400; font.FaceName = 'Consolas'
    K.SetCurrentConsoleFontEx(handle, False, C.byref(font))
    small = Rect(0,0,79,14)
    K.SetConsoleWindowInfo(handle, True, C.byref(small))
    K.SetConsoleScreenBufferSize(handle, Coord(cols, max(rows,120)))
    rect = Rect(0,0,cols-1,rows-1)
    K.SetConsoleWindowInfo(handle, True, C.byref(rect))
    K.SetConsoleTitleW('QureFlow | MySQL terminal | '+group)
    K.SetConsoleTextAttribute(handle, 7)
    os.system('cls')
    print('QureFlow - local MySQL 8.4 | synthetic demonstration data\n', flush=True)
    print(text, end='', flush=True)
    U.SetWindowPos(hwnd, 0, 40, 40, 0, 0, 0x0001 | 0x0004)
    time.sleep(1.5)
    ImageGrab.grab(window=hwnd).save(OUT / ('evidence-'+group+'.png'))
    (OUT / ('terminal-'+group+'.done')).write_text(str(hwnd))
    time.sleep(0.4)

if __name__ == '__main__':
    if len(sys.argv)>1:
        try:
            capture(sys.argv[1])
        except Exception:
            import traceback
            (OUT / ('terminal-'+sys.argv[1]+'.error')).write_text(traceback.format_exc())
            raise
    else:
        for group in sys.argv[2:] or ['function','procedure','cursor','directory','booking','schema','tests']:
            done = OUT / ('terminal-'+group+'.done')
            if done.exists(): done.unlink()
            subprocess.Popen([r'C:\Windows\System32\conhost.exe', sys.executable, str(Path(__file__).resolve()), group], cwd=ROOT)
            for i in range(120):
                if done.exists(): break
                time.sleep(.5)
            else: raise RuntimeError('Capture did not finish: '+group)
            print(group, 'captured', flush=True)
            time.sleep(1)
