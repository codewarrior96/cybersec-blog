'use client'

const TELEMETRY_PANEL_HEIGHT_CLASS = 'h-[min(74vh,840px)] md:h-[min(60vh,700px)] xl:h-[min(560px,48vh)]'

export default function DashboardSkeleton() {
  return (
    <div className="relative min-h-[calc(100vh-64px)] bg-[#000102] flex flex-col">
      <div className="mx-auto flex w-full max-w-[2400px] flex-1 gap-2 p-2 items-stretch">
        <main className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="h-[clamp(280px,42vh,620px)] sm:h-[clamp(320px,48vh,620px)] xl:h-[clamp(320px,52vh,620px)] border border-[#1a2e1a] bg-[#00020a] flex flex-col relative overflow-hidden animate-pulse">
            <div className="absolute top-0 left-0 right-0 flex items-center gap-2 px-3 py-1.5 border-b border-[#17331f]/40">
              <div className="w-1.5 h-1.5 bg-[#2b5e37] flex-none" />
              <div className="h-2 w-40 bg-[#0a180e] rounded-sm" />
              <div className="ml-auto h-2 w-24 bg-[#0a180e] rounded-sm" />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-[85%] h-[75%] bg-[#091309]/60 border border-[#17301b]/45" />
            </div>
          </div>

          <div className={`flex-none ${TELEMETRY_PANEL_HEIGHT_CLASS} border border-[#1a2e1a] bg-[#07110a]/80 flex flex-col min-h-0 overflow-hidden`}>
            <div className="flex items-center px-3 py-1.5 border-b border-[#1a2e1a] bg-[#050905]">
              <div className="h-2 w-36 bg-[#0a180e] rounded-sm animate-pulse" />
            </div>
            <div className="flex-1 p-3 flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 animate-pulse" style={{ opacity: 1 - i * 0.09 }}>
                  <div className="h-2 w-14 bg-[#0a180e] rounded-sm" />
                  <div className="h-2 w-3 bg-[#123020] rounded-sm" />
                  <div className="h-2 w-28 bg-[#0a180e] rounded-sm" />
                  <div className="h-2 w-24 bg-[#071009] rounded-sm" />
                  <div className="h-2 w-20 bg-[#071009] rounded-sm" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
