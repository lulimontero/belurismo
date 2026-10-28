import type { Metadata } from "next";
import CardShowcase from "@/components/turi/CardShowcase";
import "./tarjetas.css";

export const metadata: Metadata = {
  title: "Tarjetas del grupo | Turi Belo",
  description: "Las tarjetas virtuales de belo del grupo de viaje.",
};

// ponytail: fixed demo set from the issued cards; read listCards() here if it has to stay in sync.
const cards = [
  { holder: "Jazmin Ourens", lastFour: "0597", limitUsd: "100" },
  { holder: "Federico Tavanno", lastFour: "3443", limitUsd: "100" },
  { holder: "Franco Perez", lastFour: "5349", limitUsd: "100" },
  { holder: "Lucia Montero", lastFour: "1287", limitUsd: "100" },
];

export default function TarjetasPage() {
  return (
    <main className="tarjetas-page">
      <header>
        <p>Turi Belo</p>
        <h1>Las tarjetas del grupo</h1>
      </header>
      <CardShowcase cards={cards} />
    </main>
  );
}
