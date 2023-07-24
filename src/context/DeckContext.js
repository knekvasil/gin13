import { createContext, useState } from "react";

export const DeckContext = createContext({});

function DeckProvider({ children }) {
	const [deck, setDeck] = useState(() => initializeDeck());
	const [burnDeck, setBurnDeck] = useState([]);

	function shuffle() {
		// Fisher-Yates shuffle
		for (let i = deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[deck[i], deck[j]] = [deck[j], deck[i]];
		}
		// Update state with shuffled deck
		setDeck(deck);
	}

	function drawFromDeck() {
		if (deck.length === 0) {
			console.log("Deck is empty!");
			return null;
		}
		const drawnCard = deck[0];
		// Remove card from deck
		const updatedDeck = deck.slice(1);
		// Update deck state
		setDeck(updatedDeck);

		return drawnCard;
	}
	function drawFromBurnDeck() {
		if (burnDeck.length === 0) {
			console.log("Burn Deck is empty!");
			return null;
		}
		const drawnCard = burnDeck[0];
		// Remove card from deck
		const updatedDeck = deck.slice(1);
		// Update burn deck state
		setBurnDeck(updatedDeck);

		return drawnCard;
	}

	function resetDecks() {
		const newDeck = initializeDeck();
		// Refill deck
		setDeck(newDeck);
		// Reset burn deck back to empty
		setBurnDeck([]);
	}

	return (
		<DeckContext.Provider value={{ deck, setDeck, shuffle, drawFromDeck, drawFromBurnDeck, resetDecks }}>
			{children}
		</DeckContext.Provider>
	);
}

function initializeDeck() {
	const suits = ["Hearts", "Diamonds", "Clubs", "Spades"];
	const values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

	const deck = [];

	for (const suit of suits) {
		const svgSuit = suit.toLowerCase();
		for (const value of values) {
			const svgValue = !isNaN(value) && Number.isInteger(value) ? value : value.toLowerCase();

			const svg = `src/assets/cards/fronts/${svgSuit}_${svgValue}.svg`;
			const points = getPoints(value);

			const card = {
				suit: suit,
				value: value,
				points: points,
				svg: svg,
			};

			deck.push(card);
		}
	}
}

function getPoints(value) {
	const isFaceCard = ["J", "Q", "K", "A"].includes(value);
	if (isFaceCard) {
		return [10, 25];
	} else {
		return [parseInt(value), 25];
	}
}

export default DeckProvider;
