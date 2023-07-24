import { createContext, useContext } from "react";
import { DeckContext } from "./DeckContext";
import { PlayerContext } from "./PlayerContext";

export const HandContext = createContext({});

function HandProvider({ children }) {
	const { deck, drawFromDeck } = useContext(DeckContext);
	const { players, setPlayers } = useContext(PlayerContext);

	/* 
    Prior to calling this function, verify:
    - Deck has been reset/shuffled
    - Players have been added
    */
	function drawHands() {
		if (deck.length < players.length * 7) {
			console.log("Not enough cards in the deck to deal for all hands!");
			return;
		}

		for (const player of players) {
			const newCards = [];
			for (let i = 0; i < 7; i++) {
				const drawnCard = drawFromDeck();
				newCards.push(drawnCard);
			}
			player.hand = newCards;
			player.handValue = getHandValue(newCards);
		}
		setPlayers([...players]);
	}

	function getHandValue(hand) {
		let sum = 0;
		for (const card of hand) {
			sum += card.points;
		}
		return sum;
	}

	/*
    Can we measure how good a hand is?
    - Amount of wilds
    - Total value of cards
    - How many potential three-of-a-kinds, straight-flushes (including burn card)
    - Win probability(%)?
    */
	function getHandRating(hand) {}

	return <HandContext.Provider value={{ drawHands, getHandValue }}>{children}</HandContext.Provider>;
}

export default HandProvider;
