import { Nav } from "./components/nav/Nav";
import { Hero } from "./components/hero/Hero";
import { ProblemSection } from "./sections/ProblemSection";
import { ApproachSection } from "./sections/ApproachSection";
import { DemoCtaSection } from "./sections/DemoCtaSection";
import { Footer } from "./components/footer/Footer";

export function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <ProblemSection />
        <ApproachSection />
        <DemoCtaSection />
      </main>
      <Footer />
    </>
  );
}
