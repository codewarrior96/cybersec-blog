import type { CommandHandler } from '../types'

export const helpHandler: CommandHandler = {
  name: 'help',
  description: 'Show supported command list',
  category: 'system',
  execute() {
    return {
      output: [
        '\x1b[1;32m┌── BREACH LAB — KOMUTLAR ─────────────────────────────────────┐\x1b[0m',
        '\x1b[32m│\x1b[0m \x1b[1mDOSYA\x1b[0m   ls [-la]  cd  pwd  cat  find  stat  file  tree',
        '\x1b[32m│\x1b[0m \x1b[1mMETİN\x1b[0m   grep  awk  sed  wc  head  tail  sort  uniq  strings',
        '\x1b[32m│\x1b[0m \x1b[1mSİSTEM\x1b[0m  whoami  id  uname  ps  top  env  history  crontab',
        '\x1b[32m│\x1b[0m \x1b[1mİZİN\x1b[0m    chmod  sudo -l  find -perm -4000',
        '\x1b[32m│\x1b[0m \x1b[1mAĞ\x1b[0m      ifconfig  netstat  ss  ping  curl',
        '\x1b[32m│\x1b[0m \x1b[1mARSİV\x1b[0m   xxd  base64  file  strings',
        '\x1b[32m│\x1b[0m \x1b[1mDİĞER\x1b[0m   man  which  bash  python3  submit <FLAG>  clear',
        '\x1b[32m│\x1b[0m',
        '\x1b[32m│\x1b[0m \x1b[1;33mGÜVENLİK ARAÇLARI (simülasyon)\x1b[0m',
        '\x1b[32m│\x1b[0m \x1b[33mTARAMA\x1b[0m  nmap  nikto  nuclei  wpscan',
        '\x1b[32m│\x1b[0m \x1b[33mWEB\x1b[0m     sqlmap  gobuster  dirb  wfuzz',
        '\x1b[32m│\x1b[0m \x1b[33mKEŞİF\x1b[0m   amass  sublist3r  recon-ng  enum4linux',
        '\x1b[32m│\x1b[0m \x1b[33mSALDIRI\x1b[0m hydra  responder  nc  tcpdump',
        '\x1b[32m│\x1b[0m \x1b[33mŞİFRE\x1b[0m   hashcat  john  aircrack-ng',
        '\x1b[32m│\x1b[0m \x1b[33mDİĞER\x1b[0m   msfconsole  msfvenom  ssh  ftp',
        '\x1b[1;32m└──────────────────────────────────────────────────────────────┘\x1b[0m',
        '\x1b[90mPipe desteği: cat log.txt | grep "ERROR" | wc -l\x1b[0m',
      ],
      evidence: [],
      exitCode: 0,
    }
  },
}
