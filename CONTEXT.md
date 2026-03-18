# BREACH TERMINAL — cybersec-blog

## Live URL
https://cybersec-blog-pi.vercel.app

## Stack
- Next.js 14 App Router
- TypeScript strict
- Tailwind CSS + inline styles
- Vercel (auto-deploy from main branch)
- font-mono everywhere
- Neon green #00ff41 + amber #f59e0b palette

## Pages
- / → Homepage (LoginModal overlay → BootSequence → InteractiveTerminal + Stats + ThreatFeed + Categories + RecentPosts)
- /blog → Blog listing with sidebar, search, tags
- /blog/[slug] → MDX post detail
- /portfolio → Skills, certs, projects, timeline
- /roadmap → 4-stage cybersec education roadmap
- /cve-radar → Live CVE feed from NVD API
- /breach-timeline → Interactive timeline of 40 major cyber incidents (2000-2024)
- /about → About page

## Components
BootSequence, InteractiveTerminal, MatrixRain, BlogCard, CountUp, Header, Footer, ThreatFeed, SearchModal, PageTransition, ReadingProgress, BackToTop, CodeBlock, MDXComponents, TypingText, LoginModal

## API Routes
- /api/cybernews → RSS aggregator
- /api/cves → NVD CVE feed
- /api/posts → getAllPosts endpoint

## Public Assets
- /hacker.jpg → Login modal background
- /skull.jpg → Skull logo in login modal

## Login System
- Demo credentials: username=ghost password=demo_pass (prefilled)
- Client-side only, localStorage auth
- LoginModal appears on homepage as overlay

## Git
github.com/codewarrior96/cybersec-blog
Push: git add . ; git commit -m "message" ; git push origin main

## Design Language
Black bg, neon green #00ff41, scanlines, font-mono, CRT terminal aesthetic.

## Next Steps
- Community posts system
- Beğeni + yorum sistemi
- Profil sidebar (oturum açınca görünür)
- Blog card redesign
- Mobile responsive düzeltmeleri
- Header/Footer redesign
