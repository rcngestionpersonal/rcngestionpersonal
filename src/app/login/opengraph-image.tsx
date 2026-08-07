import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0812',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -140,
            left: -100,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: 'rgba(167,139,250,0.28)',
            filter: 'blur(120px)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -160,
            right: -120,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: 'rgba(45,212,191,0.18)',
            filter: 'blur(120px)',
            display: 'flex',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
          <span style={{ color: '#2dd4bf', fontSize: 40 }}>✦</span>
          <span style={{ color: '#f3f1fa', fontSize: 34, fontWeight: 600, letterSpacing: '-0.01em' }}>REDINMO.IO</span>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 36,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#f3f1fa',
            textAlign: 'center',
            maxWidth: 920,
            lineHeight: 1.15,
            position: 'relative',
          }}
        >
          Tus inmuebles y pedidos ahora hacen match
        </div>
        <div style={{ display: 'flex', marginTop: 26, fontSize: 24, color: '#a9a1cd', position: 'relative' }}>
          redinmo.io · el hub que conecta colegas
        </div>
      </div>
    ),
    { ...size },
  );
}
