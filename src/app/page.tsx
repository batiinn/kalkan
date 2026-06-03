import { Scanner } from "./components/Scanner";
import { GithubIcon, ShieldIcon } from "./components/icons";

const CHECKS = [
  { title: "SSL/TLS Sertifikası", desc: "Geçerlilik, süre, protokol sürümü ve zincir doğruluğu." },
  { title: "Güvenlik Header'ları", desc: "HSTS, CSP, X-Frame-Options ve sızdırılan sunucu bilgisi." },
  { title: "Açıkta Kalan Dosyalar", desc: ".env, .git, yedekler ve phpinfo gibi kritik sızıntılar." },
  { title: "Açık Port Taraması", desc: "İnternete açık veritabanları (MySQL, Redis, Mongo), RDP, Telnet." },
  { title: "WordPress Güvenliği", desc: "Kullanıcı listeleme, XML-RPC ve sürüm ifşası denetimi." },
  { title: "E-posta Güvenliği", desc: "SPF, DMARC ve DKIM ile sahte e-posta (spoofing) koruması." },
  { title: "CORS & Karışık İçerik", desc: "Hatalı CORS yapılandırması ve şifresiz yüklenen kaynaklar." },
  { title: "Subdomain Keşfi", desc: "Sertifika günlüklerinden açıkta kalan test/dev ortamları." },
  { title: "Teknoloji Parmak İzi", desc: "CMS/sunucu tespiti ve açıkta kalan sürüm uyarıları." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-grid">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]">
            <ShieldIcon className="h-6 w-6" />
          </span>
          <span className="text-lg font-bold tracking-tight">Kalkan</span>
          <span className="mono ml-1 rounded-md border border-[color:var(--color-border)] px-1.5 py-0.5 text-[10px] text-[color:var(--color-ink-dim)]">
            açık kaynak
          </span>
        </div>
        <a
          href="https://github.com/batiinn/kalkan"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] px-3.5 py-2 text-sm text-[color:var(--color-ink-dim)] transition-colors hover:border-[color:var(--color-border-bright)] hover:text-[color:var(--color-ink)]"
        >
          <GithubIcon className="h-4 w-4" />
          GitHub
        </a>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-8 text-center sm:pt-24">
        <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-1.5 text-xs text-[color:var(--color-ink-dim)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[color:var(--color-accent)] opacity-75 pulse-ring" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--color-accent)]" />
          </span>
          Türkiye&apos;nin ücretsiz web güvenlik tarayıcısı
        </div>

        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
          Sitenizin güvenliğini
          <span className="bg-gradient-to-r from-[color:var(--color-accent)] to-[#7dd3fc] bg-clip-text text-transparent"> saniyeler içinde</span> görün
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-[color:var(--color-ink-dim)] sm:text-lg">
          SSL, güvenlik header&apos;ları, e-posta koruması, açıkta kalan dosyalar ve daha fazlası — tek tıkla,
          Türkçe ve puanlı rapor. Kayıt yok, sınır yok, tamamen ücretsiz.
        </p>

        <div className="mt-10">
          <Scanner />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">13 modülde kapsamlı denetim</h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-[15px] text-[color:var(--color-ink-dim)]">
          Yurtdışında ayrı ayrı ücretli olan kontrolleri tek raporda topluyoruz.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map((c) => (
            <div
              key={c.title}
              className="group rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 transition-colors hover:border-[color:var(--color-accent)]/40"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)] transition-transform group-hover:scale-105">
                <ShieldIcon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--color-ink-dim)]">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: "Web tasarımcılar", d: "Müşterinize teslim öncesi sitenin güvenlik notunu gösterin, fark yaratın." },
            { t: "Siber güvenlikçiler", d: "Hızlı keşif ve saldırı yüzeyi taraması için pratik bir ön araç." },
            { t: "İşletme sahipleri", d: "Teknik bilgi gerektirmeden sitenizin risklerini Türkçe öğrenin." },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
              <h3 className="font-semibold text-[color:var(--color-accent)]">{x.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-ink-dim)]">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[color:var(--color-border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-[color:var(--color-ink-faint)] sm:flex-row">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-[color:var(--color-accent)]" />
            <span>Kalkan — açık kaynak web güvenlik tarayıcısı · MIT lisansı</span>
          </div>
          <span className="mono">Yalnızca pasif analiz yapar · izinsiz saldırı içermez</span>
        </div>
      </footer>
    </main>
  );
}
