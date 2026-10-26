import { randomInt, randomUUID } from "node:crypto";
import type { Company, News } from "./game-types";

// Original parody writing for the classroom game. These are NOT real posts.
export function makeNews(company: Company): News[] {
  const space = company === "spacex";
  const groups = [
    [
      { text: space ? "Starlink just signed a global airline deal. Wi-Fi at 35,000 feet should not cost more than the plane." : "New battery line passed factory tests. More range, lower cost. The engineers have earned their pizza.", context: "Company update · a specific business claim", impact: 25, explanation: "The contract / production improvement was real within the game. Future earnings improved." },
      { text: space ? "SPCX to Mars. The moon is a rounding error. 🚀🚀🚀" : "TSLA to the moon. Cars optional. Vibes mandatory. 🚀", context: "Personal post · no business numbers", impact: 0, explanation: "Just hype. No change to earnings or the game's settlement value." },
    ],
    [
      { text: space ? "Launch delayed. Turns out 'mostly attached' is not an acceptable engine status." : "Pausing a production line for quality checks. Apparently 'it works on my car' is not a test plan.", context: "Operations update · a specific business claim", impact: -20, explanation: "The delay was real within the game. Costs rose and expected earnings fell." },
      { text: space ? "Considering renaming SpaceX to SpaceXX. Twice the X. Same amount of space." : "Considering replacing the steering wheel with a gaming controller. Poll closes when I get bored.", context: "Personal post · an idea, not an announcement", impact: 0, explanation: "A joke, not a business change. The settlement value did not move." },
    ],
    [
      { text: space ? "New launch contract signed. Paid in actual money, not exposure. Huge if you enjoy revenue." : "Fleet order signed. Yes, real cars. Yes, real money. No, I cannot expense a flamethrower to this deal.", context: "Contract update · a specific business claim", impact: 15, explanation: "A signed contract improved future earnings within the game." },
      { text: space ? "Inspection found a hardware issue. Repairs before the next launch. Rockets are expensive enough without surprise confetti." : "Recall confirmed. Replacing the affected hardware. The car should not have a surprise sauna mode.", context: "Operations update · a specific business claim", impact: -15, explanation: "The repair cost was real within the game and reduced the settlement value." },
      { text: space ? "I have a very good feeling about space today. Source: I looked up." : "Stock price too low imo. Source: the group chat.", context: "Personal opinion · no new financial information", impact: 0, explanation: "An opinion did not change the company's earnings. Any price move came from the crowd." },
    ],
  ];
  return groups.map((group, i) => ({ ...group[randomInt(group.length)], id: randomUUID(), beat: [1, 3, 4][i] }));
}
