import dynamic from 'next/dynamic';

// se il componente è in src/components/FantacalcioManager.tsx:
const FantacalcioManager = dynamic(
  () => import('../components/FantacalcioManager'),
  { ssr: false }
);

export default function Page() {
  return <FantacalcioManager />;
}
