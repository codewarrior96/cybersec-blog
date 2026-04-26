import type { FSNode, DirNode } from './types'

// ─── Virtual Filesystem Tree ──────────────────────────────────────────────────

export const ROOT: DirNode = {
  type: 'dir', perms: 'drwxr-xr-x',
  children: {
    home: {
      type: 'dir', perms: 'drwxr-xr-x',
      children: {
        operator: {
          type: 'dir', perms: 'drwxr-xr-x',
          children: {
            'README.txt': {
              type: 'file', perms: '-rw-r--r--',
              content: [
                'BREACH LAB — Siber Güvenlik Eğitim Terminali',
                '',
                '  challenges/   CTF görevleri (6 seviye)',
                '  tools/        Güvenlik araç scriptleri',
                '  notes/        Referans notları',
                '  .bash_history Komut geçmişi',
                '',
                'Yardım: help',
                'Görevler: cd challenges && cat README.txt',
              ].join('\n'),
            },
            challenges: {
              type: 'dir', perms: 'drwxr-xr-x',
              children: {
                'README.txt': {
                  type: 'file', perms: '-rw-r--r--',
                  content: [
                    'CTF GÖREVLERİ — Baştan Sona',
                    '',
                    '  01-recon/   Sistem keşfi          [KOLAY]',
                    '  02-perms/   Dosya izinleri         [KOLAY]',
                    '  03-hidden/  Gizli dosyalar          [ORTA]',
                    '  04-grep/    Metin analizi            [ORTA]',
                    '  05-privesc/ Yetki yükseltme           [ZOR]',
                    '  06-network/ Ağ analizi                [ZOR]',
                    '',
                    'Her gorev klasorunde mission.txt gorev tanimini icerir.',
                    'Bayrak (FLAG) bazen flag.txt dosyasinda, bazen script/log/gizli dosya ciktisinda bulunur.',
                    'Bayragi bulduktan sonra: submit FLAG{...}',
                  ].join('\n'),
                },
                '01-recon': {
                  type: 'dir', perms: 'drwxr-xr-x',
                  children: {
                    'mission.txt': {
                      type: 'file', perms: '-rw-r--r--',
                      content: [
                        '[LEVEL 1] KEŞİF — KOLAY',
                        '─────────────────────────',
                        '',
                        'Görev: /etc/passwd kaç satır içeriyor?',
                        '',
                        'İpucu 1: cat /etc/passwd',
                        'İpucu 2: cat /etc/passwd | wc -l',
                        'İpucu 3: Sonra flag.txt oku',
                      ].join('\n'),
                    },
                    'flag.txt': {
                      type: 'file', perms: '-r--------',
                      content: 'FLAG{r3con_master_l1nux}\n',
                    },
                  },
                },
                '02-perms': {
                  type: 'dir', perms: 'drwxr-xr-x',
                  children: {
                    'mission.txt': {
                      type: 'file', perms: '-rw-r--r--',
                      content: [
                        '[LEVEL 2] DOSYA İZİNLERİ — KOLAY',
                        '──────────────────────────────────',
                        '',
                        'Görev: secret.sh çalıştırılabilir yap ve çalıştır',
                        '',
                        'İpucu 1: ls -la (mevcut izinleri gör)',
                        'İpucu 2: chmod +x secret.sh',
                        'İpucu 3: bash secret.sh',
                      ].join('\n'),
                    },
                    'secret.sh': {
                      type: 'file', perms: '-rw-r--r--',
                      content: '#!/bin/bash\necho "İzinler tamam!"\necho "Bayrak: FLAG{ch4mod_p3rm1ss10ns}"\n',
                    },
                  },
                },
                '03-hidden': {
                  type: 'dir', perms: 'drwxr-xr-x',
                  children: {
                    'mission.txt': {
                      type: 'file', perms: '-rw-r--r--',
                      content: [
                        '[LEVEL 3] GİZLİ DOSYALAR — ORTA',
                        '─────────────────────────────────',
                        '',
                        'Görev: Bu klasörde gizli bir dosya var. Bul ve oku.',
                        '',
                        'İpucu 1: ls -la (nokta ile başlayan dosyalar gizlidir)',
                        'İpucu 2: cat <gizli_dosya>',
                      ].join('\n'),
                    },
                    '.vault': {
                      type: 'file', perms: '-rw-------',
                      content: 'FLAG{h1dden_1n_pl41n_s1ght}\n',
                    },
                    'decoy.txt': {
                      type: 'file', perms: '-rw-r--r--',
                      content: 'Burada değil... daha derine bak.\n',
                    },
                  },
                },
                '04-grep': {
                  type: 'dir', perms: 'drwxr-xr-x',
                  children: {
                    'mission.txt': {
                      type: 'file', perms: '-rw-r--r--',
                      content: [
                        '[LEVEL 4] METİN ANALİZİ — ORTA',
                        '────────────────────────────────',
                        '',
                        'Görev: Bu klasördeki access.log dosyasında bir FLAG saklı.',
                        'grep komutu ile FLAG kelimesini içeren satırı bul.',
                        '',
                        'İpucu: grep "FLAG" access.log',
                      ].join('\n'),
                    },
                    'access.log': {
                      type: 'file', perms: '-rw-r--r--',
                      content: [
                        '192.168.1.1 - GET /index.html 200',
                        '10.0.0.5 - POST /login 401 "invalid credentials"',
                        '45.33.32.156 - GET /admin FLAG{gr3p_1s_p0w3r} 403',
                        '172.16.0.1 - GET /robots.txt 200',
                        '10.0.0.99 - GET /.env 404',
                        '192.168.1.100 - POST /api/users 500',
                      ].join('\n'),
                    },
                  },
                },
                '05-privesc': {
                  type: 'dir', perms: 'drwxr-xr-x',
                  children: {
                    'mission.txt': {
                      type: 'file', perms: '-rw-r--r--',
                      content: [
                        '[LEVEL 5] YETKİ YÜKSELTMESİ — ZOR',
                        '─────────────────────────────────────',
                        '',
                        'Görev: Sistemdeki privilege escalation vektörlerini bul',
                        '',
                        'İpucu 1: sudo -l ile izin verilen root komutlarını gör',
                        'İpucu 2: find neden NOPASSWD çalışıyor, bunu analiz et',
                        'İpucu 3: sudo find . -exec cat flag.txt \\; ile root okuma simülasyonunu uygula',
                      ].join('\n'),
                    },
                    'flag.txt': {
                      type: 'file', perms: '-rw-------',
                      content: 'FLAG{pr1v3sc_r00t_0wn3d}\n',
                    },
                  },
                },
                '06-network': {
                  type: 'dir', perms: 'drwxr-xr-x',
                  children: {
                    'mission.txt': {
                      type: 'file', perms: '-rw-r--r--',
                      content: [
                        '[LEVEL 6] AĞ ANALİZİ — ZOR',
                        '─────────────────────────────',
                        '',
                        'Görev: Açık portları listele ve alışılmadık servisi bul.',
                        'Şüpheli portu sistem loglarında doğrula.',
                        '',
                        'İpucu 1: ss -tulpn veya netstat -tulpn',
                        'İpucu 2: Alışılmadık port 4444 olabilir mi?',
                        'İpucu 3: grep 4444 /var/log/syslog',
                      ].join('\n'),
                    },
                    'flag.txt': {
                      type: 'file', perms: '-rw-------',
                      content: 'FLAG{n3tw0rk_m4st3r_2024}\n',
                    },
                  },
                },
              },
            },
            tools: {
              type: 'dir', perms: 'drwxr-xr-x',
              children: {
                'README.txt': {
                  type: 'file', perms: '-rw-r--r--',
                  content: 'ARAÇLAR:\n  nmap.sh      → Port tarayıcı simülatörü\n  linpeas.sh   → Privesc kontrol\n  hashcrack.py → MD5 kırıcı (demo)\n\nKullanım: bash <araç.sh>\n',
                },
                'nmap.sh': {
                  type: 'file', perms: '-rwxr-xr-x',
                  content: '#!/bin/bash\necho "[*] Nmap Simüle Tarama"\necho "PORT     STATE  SERVICE  VERSION"\necho "22/tcp   open   ssh      OpenSSH 8.2p1"\necho "80/tcp   open   http     nginx 1.18.0"\necho "443/tcp  open   https    nginx 1.18.0"\necho "3306/tcp open   mysql    MySQL 8.0.26"\necho "8080/tcp open   http-alt Node.js"\necho "[+] Tarama tamamlandı — 5 açık port"\n',
                },
                'linpeas.sh': {
                  type: 'file', perms: '-rwxr-xr-x',
                  content: '#!/bin/bash\necho "╔══════════ LinPEAS v4.5.2 ══════════╗"\necho "[+] SUID/SGID dosyaları:"\necho "  /usr/bin/sudo  /usr/bin/passwd  /usr/bin/newgrp"\necho "[+] Yazılabilir dizinler:"\necho "  /tmp  /var/tmp  /dev/shm"\necho "[+] Sudo konfigürasyonu:"\necho "  operator ALL=(ALL) NOPASSWD: /usr/bin/vim"\necho "[!] Dikkat: vim ile root shell alınabilir!"\necho "  sudo vim -c \'!bash\'"\n',
                },
                'hashcrack.py': {
                  type: 'file', perms: '-rwxr-xr-x',
                  content: '#!/usr/bin/env python3\nimport hashlib\n\nWORDLIST = ["password", "123456", "admin", "qwerty", "letmein", "root"]\nTARGET = "5f4dcc3b5aa765d61d8327deb882cf99"  # MD5\n\nfor word in WORDLIST:\n    if hashlib.md5(word.encode()).hexdigest() == TARGET:\n        print(f"[+] Şifre bulundu: {word}")\n        break\nelse:\n    print("[-] Wordlist\'te bulunamadı")\n',
                },
              },
            },
            notes: {
              type: 'dir', perms: 'drwxr-xr-x',
              children: {
                'linux-commands.txt': {
                  type: 'file', perms: '-rw-r--r--',
                  content: 'TEMEL LINUX KOMUTLARI\n\nDOSYA: ls -la | cat | grep | find | chmod | chown\nMETİN: grep | awk | sed | wc | head | tail | sort\nSİSTEM: ps aux | top | uname -a | id | env | which\nAĞ: ifconfig | netstat | ss | ping | curl | wget\nCTF: strings | xxd | base64 | file | binwalk\n',
                },
                'ctf-checklist.txt': {
                  type: 'file', perms: '-rw-r--r--',
                  content: 'CTF BAŞLANGIÇ LİSTESİ\n\n[ ] file <hedef>             → Dosya türü\n[ ] strings <hedef>          → Okunabilir metinler\n[ ] xxd <hedef> | head       → Hex dump\n[ ] find / -name "flag*"     → Bayrak arama\n[ ] env | grep -i flag       → Ortam değişkenleri\n[ ] cat ~/.bash_history      → Geçmiş komutlar\n[ ] sudo -l                  → Sudo yetkiler\n[ ] find / -perm -4000       → SUID dosyaları\n[ ] crontab -l               → Zamanlanmış görevler\n',
                },
              },
            },
            '.bash_history': {
              type: 'file', perms: '-rw-------',
              content: 'ls -la\ncd challenges\ncat mission.txt\ngrep -r FLAG .\nsudo -l\nfind / -perm -4000 2>/dev/null\ncat /etc/passwd\nnetstat -tulpn\n',
            },
          },
        },
      },
    },
    etc: {
      type: 'dir', perms: 'drwxr-xr-x',
      children: {
        passwd: {
          type: 'file', perms: '-rw-r--r--',
          content: 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nmysql:x:999:999:MySQL Server:/var/lib/mysql:/bin/false\noperator:x:1000:1000:Operator:/home/operator:/bin/bash\n',
        },
        shadow: {
          type: 'file', perms: '-rw-r-----',
          content: 'cat: /etc/shadow: İzin reddedildi\n',
        },
        'os-release': {
          type: 'file', perms: '-rw-r--r--',
          content: 'PRETTY_NAME="Ubuntu 22.04.3 LTS"\nNAME="Ubuntu"\nVERSION_ID="22.04"\nVERSION="22.04.3 LTS (Jammy Jellyfish)"\nID=ubuntu\n',
        },
        hostname: { type: 'file', perms: '-rw-r--r--', content: 'breach-lab\n' },
        crontab:  { type: 'file', perms: '-rw-r--r--', content: '*/5 * * * * root /usr/bin/backup.sh\n0 3 * * 0 root /usr/bin/cleanup.sh\n' },
      },
    },
    usr: {
      type: 'dir', perms: 'drwxr-xr-x',
      children: {
        bin: {
          type: 'dir', perms: 'drwxr-xr-x',
          children: {
            find: {
              type: 'file', perms: '-rwsr-xr-x',
              content: 'ELF binary: GNU find with SUID bit enabled for lab simulation\n',
            },
            passwd: {
              type: 'file', perms: '-rwsr-xr-x',
              content: 'ELF binary: passwd with standard SUID permissions\n',
            },
            sudo: {
              type: 'file', perms: '-rwsr-xr-x',
              content: 'ELF binary: sudo with standard SUID permissions\n',
            },
          },
        },
      },
    },
    var: {
      type: 'dir', perms: 'drwxrwxr-x',
      children: {
        log: {
          type: 'dir', perms: 'drwxr-xr-x',
          children: {
            syslog: {
              type: 'file', perms: '-rw-r-----',
              content: 'Jan 15 08:00 breach-lab sshd: Accepted publickey for operator\nJan 15 08:01 breach-lab sudo: operator ran /bin/bash\nJan 15 08:12 breach-lab kernel: [UFW BLOCK] IN=eth0 SRC=45.33.32.156\nJan 15 08:15 breach-lab sshd: Failed password for root from 45.33.32.156\nJan 15 08:16 breach-lab sshd: Failed password for root from 45.33.32.156\nJan 15 08:17 breach-lab sshd: Failed password for root from 45.33.32.156\nJan 15 08:24 breach-lab backdoor-agent: BACKDOOR detected on port 4444 token=FLAG{n3tw0rk_m4st3r_2024}\n',
            },
          },
        },
      },
    },
    tmp: { type: 'dir', perms: 'drwxrwxrwt', children: {} },
  },
}

// ─── Path Utilities ───────────────────────────────────────────────────────────

export function resolvePath(cwd: string, target: string): string {
  const expanded = target.replace(/^~/, '/home/operator')
  if (expanded.startsWith('/')) return normalizePath(expanded)
  const parts = cwd === '/' ? [] : cwd.split('/').filter(Boolean)
  for (const segment of expanded.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return '/' + parts.join('/')
}

function normalizePath(path: string): string {
  const parts: string[] = []
  for (const segment of path.split('/').filter(Boolean)) {
    if (segment === '..') parts.pop()
    else if (segment !== '.') parts.push(segment)
  }
  return '/' + parts.join('/')
}

export function getNode(path: string): FSNode | null {
  if (path === '/') return ROOT
  let current: FSNode = ROOT
  for (const segment of path.split('/').filter(Boolean)) {
    if (current.type !== 'dir') return null
    const child: FSNode | undefined = current.children[segment]
    if (!child) return null
    current = child
  }
  return current
}

export function basename(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? '/'
}

export function colorEntry(name: string, node: FSNode): string {
  if (node.type === 'dir')              return `\x1b[1;34m${name}/\x1b[0m`
  if (node.perms.includes('x'))         return `\x1b[1;32m${name}*\x1b[0m`
  if (name.startsWith('.'))             return `\x1b[90m${name}\x1b[0m`
  return name
}

