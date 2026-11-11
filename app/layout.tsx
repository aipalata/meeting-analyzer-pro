import './style.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {title:'Конспект встречи',description:'Расшифровка и конспект видеовстреч'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="ru"><body>{children}</body></html>}
