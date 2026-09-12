/* =========================================================
   EVENTS
   Random street encounters triggered by risky work actions.
   Each event presents choices whose outcomes depend on stats.
   Resolved through a modal (see Game.ui.showEventModal).
========================================================= */

Game.events = {};

Game.EVENTS = [
    {
        id: "thug_notices_bag",
        text: "A local thug notices your bag and starts walking your way.",
        weight: 10,
        choices: [
            { label: "RUN", resolve: () => {
                if (Game.util.chance(0.5 + Game.player.effectiveLuck() * 0.02)) {
                    Game.player.log("You outran a thug.");
                    return "You get away clean.";
                }
                Game.player.addHealth(-Game.util.randInt(2, 5));
                return "You trip and take a hit before losing him.";
            }},
            { label: "FIGHT", resolve: () => {
                Game.combat.start("street_thug");
                return null;
            }},
            { label: "PAY $20", resolve: () => {
                if (Game.player.spendMoney(20)) return "He takes the money and walks off.";
                return "You don't have $20. He isn't happy about that.";
            }},
            { label: "INTIMIDATE", resolve: () => {
                if (Game.util.chance(0.3 + Game.player.effectiveCharisma() * 0.03 + Game.state.resources.fear * 0.001)) {
                    Game.player.addReputation({ fear: 3 });
                    return "He backs off. Word will spread.";
                }
                Game.combat.start("street_thug");
                return null;
            }}
        ]
    },
    {
        id: "found_backpack",
        text: "You find an abandoned backpack with some cash inside.",
        weight: 12,
        choices: [
            { label: "TAKE IT", resolve: () => {
                const amount = Game.util.randInt(20, 60);
                Game.player.addMoney(amount);
                return `You find ${Game.util.formatMoney(amount)}.`;
            }}
        ]
    },
    {
        id: "followed",
        text: "You notice someone has been following you for a block.",
        weight: 8,
        choices: [
            { label: "IGNORE", resolve: () => "You keep walking. Nothing happens." },
            { label: "CONFRONT", resolve: () => {
                if (Game.util.chance(0.4 + Game.player.effectiveStrength() * 0.02)) {
                    Game.player.addReputation({ fear: 2, respect: 1 });
                    return "They back off fast. You feel a little more feared.";
                }
                Game.combat.start("street_thug");
                return null;
            }},
            { label: "HIDE", resolve: () => {
                if (Game.util.chance(0.6)) return "You duck into an alley and lose them.";
                Game.player.addHealth(-Game.util.randInt(1, 4));
                return "They catch up and shove you before leaving.";
            }}
        ]
    },
    {
        id: "police_questioning",
        text: "Police are questioning people a block ahead.",
        weight: 8,
        choices: [
            { label: "AVOID", resolve: () => "You take the long way around." },
            { label: "TALK", resolve: () => {
                if (Game.util.chance(0.4 + Game.player.effectiveCharisma() * 0.03)) {
                    return "You talk your way past without trouble.";
                }
                const fine = Math.min(Game.state.resources.money, Game.util.randInt(10, 30));
                Game.state.resources.money -= fine;
                return `They fine you ${Game.util.formatMoney(fine)} for loitering.`;
            }},
            { label: "RUN", resolve: () => {
                Game.player.addHealth(-Game.util.randInt(1, 3));
                return "You bolt. You're clear, but you scraped yourself up doing it.";
            }}
        ]
    },
    {
        id: "injured_stranger",
        text: "You find an injured stranger slumped against a wall.",
        weight: 7,
        choices: [
            { label: "HELP", resolve: () => {
                Game.player.addFood(-Game.util.randInt(2, 5));
                Game.player.addReputation({ trust: 4, respect: 2 });
                return "You help them up. They thank you and move on.";
            }},
            { label: "IGNORE", resolve: () => "Not your problem. You keep moving." },
            { label: "ROB", resolve: () => {
                const amount = Game.util.randInt(10, 25);
                Game.player.addMoney(amount);
                Game.player.addReputation({ fear: 3, trust: -3 });
                return `You take ${Game.util.formatMoney(amount)} off them. It doesn't feel great.`;
            }}
        ]
    },
    {
        id: "old_friend",
        text: "A former friend recognizes you and asks for help.",
        weight: 6,
        choices: [
            { label: "HELP ($15)", resolve: () => {
                if (Game.player.spendMoney(15)) {
                    Game.player.addReputation({ trust: 5 });
                    return "You spot them $15. They won't forget it.";
                }
                return "You want to help, but you're flat broke.";
            }},
            { label: "REFUSE", resolve: () => {
                Game.player.addReputation({ trust: -2 });
                return "You walk away. They don't look surprised.";
            }}
        ]
    }
];

Game.events.trigger = function () {
    if (Game.skills.has("known_face") && Game.util.chance(0.2)) return;

    let pool = Game.EVENTS;
    if (Game.skills.has("lucky_bastard")) {
        pool = Game.EVENTS.filter(e => e.id === "found_backpack" || e.id === "old_friend").concat(Game.EVENTS);
    }

    const event = Game.util.weightedPick(pool.map(e => ({ ...e, weight: e.weight })));
    Game.state.stats.totalEventsSeen++;
    Game.ui.showEventModal(event);
};
