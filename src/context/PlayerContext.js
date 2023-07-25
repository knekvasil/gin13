import { createContext, useState, useContext } from "react";
import { DeckContext } from "./DeckContext";
import { EvaluationContext } from "./EvaluationContext";

export const PlayerContext = createContext({});

const crypto = require("crypto");

function PlayerProvider({ children }) {
	const [players, setPlayers] = useState({});

	const { setBurnDeck } = useContext(DeckContext);
	const { canPlay, canBuild } = useContext(EvaluationContext);

	function addPlayer(name) {
		const newPlayer = {
			name: name,
			hand: [],
			handValue: 0,
		};
		setPlayers((prevPlayers) => ({ ...prevPlayers, [generateId()]: newPlayer }));
	}

	// Remove a card from player's hand and add it to the top of the burn deck.
	function burnCard(playerId, cardIndex) {
		// Create copy of players and playerHand arrays for safe mutability
		const updatedPlayers = [...players];
		const playerHand = [...updatedPlayers[playerId].hand];

		// Remove the burn card from the hand and save it
		const burnedCard = playerHand.splice(cardIndex, 1)[0];

		// Update the players hand with the spliced array
		updatedPlayers[playerId].hand = playerHand;

		setPlayers(updatedPlayers);
		// The most recent burned card will always be at index 0;
		setBurnDeck((prevBurnDeck) => [burnedCard, ...prevBurnDeck]);
	}

	function play(playerId, cardIndices) {
		// Create copy of players and playerHand arrays for safe mutability
		const updatedPlayers = [...players];
		const playerHand = [...updatedPlayers[playerId].hand];

		const playCards = [];

		for (const index in cardIndices) {
			playCards.push(playerHand[index]);
		}

		const isValidMove = canPlay(playCards);

		if (isValidMove) {
			// TODO...
		}

		return 0;
	}

	function build(playerId, cardIndices, buildIndex) {
		// Create copy of players and playerHand arrays for safe mutability
		const updatedPlayers = [...players];
		const playerHand = [...updatedPlayers[playerId].hand];
		return 0;
	}

	return (
		<PlayerContext.Provider value={{ players, setPlayers, addPlayer, burnCard, play, build }}>
			{children}
		</PlayerContext.Provider>
	);
}

function generateId() {
	const bytes = crypto.randomBytes(10);
	return bytes.toString("hex");
}

export default PlayerProvider;
