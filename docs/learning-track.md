# The learning track

Level 1 hands you a building, a starter program that sends one elevator between two floors and never
explains itself, and a reference page that assumes you already know which of its methods you are
looking for. The track is what comes before that: eight small buildings, under **Learning track** in
the level menu or at `#level=tutorial-1`, each one built around a single mistake.

Every level of it starts with a program that runs and loses, and asks you to find out why. The
elevator that only ever visits one of two floors; the handler nobody subscribed; the passengers
whose buttons are ignored; the destination queue that is filled and never started; the car that
sweeps nine floors because it never asked who was waiting; the indicators that tell everybody it is
going up, so half the building refuses to board; the second elevator that stands still all run. The
eighth is an empty `init` in level 1's building, against level 1's bar.

The buildings are tuned so that the lesson is not a coin flip. Each level pins the seed it is played
on, and on that seed the program you are handed loses and the level's own answer wins — both
measured, not hoped for. `src/game/tutorial-solutions.test.ts` replays both programs of every one of
them on ten seeds, and `src/game/tutorial-sweep.test.ts` replays three on four hundred: the two
whose bar is a worst case rather than a total, where one unlucky passenger decides the run, and the
one whose answer is measured losing a seed. A change to the physics that quietly turns a lesson
upside down fails the suite instead of reaching a player.

Each of them carries three hints, folded away until you want one — the third is the answer in full,
because a hint you cannot get past is not a hint — and a **Why this happens** note on what the run
was really doing. That card is the lesson and nothing else — no header naming the track, no counter
of what you have finished, no buttons under the prose: what is true of the whole track is the level
menu's business, and this is the level. The editor belongs to the track too: what you write is kept
per tutorial level and your own program in the game's editor is never written to, so what leaves the
track is whatever you copy out with the **Copy this program** button beside the answer. Cleared ones
are remembered in `localStorage` and the menu gives each of them three stars — the track asks nothing
beyond its own condition, so clearing one is gold outright — and nothing is ever locked: every one of
them is playable by its address from the first visit.

The track refuses one thing you can write in the URL, with a console warning and taken back out of
the address bar: `seed`, because whether the given program really loses is a fact about the
passenger stream as much as about the program — the fifth level's sweep does win on some seeds — so
`#level=tutorial-5,seed=42a` would sit a player in front of a broken program winning. Because the
seed is the level's rather than yours, the bar above the building shows no seed line while a
tutorial level is open — there is nothing there to pin and nothing to unpin — and Restart brings
back the same passengers rather than a fresh draw. An address the track has no level for, such as
`tutorial-9`, starts the first of them rather than level 1: whoever wrote it was asking for the
track.

The whole track — titles, goals, hints and explanations — is translated, so it can be played in
Russian as well as English.
