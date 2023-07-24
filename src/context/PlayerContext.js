import { createContext, useState, useContext } from "react";
import { DeckContext } from "./DeckContext";

export const PlayerContext = createContext({});

const crypto = require("crypto");

function PlayerProvider({ children }) {
	const [players, setPlayers] = useState([]);

	const { setBurnDeck } = useContext(DeckContext);

	function addPlayer(name) {
		const newPlayer = {
			_id: generateId(),
			name: name,
			hand: [],
			handValue: 0,
		};
		setPlayers((prevPlayers) => [...prevPlayers, newPlayer]);
	}

	// Remove a card from player's hand and add it to the top of the burn deck.
	function burnCard(playerIndex, cardIndex) {
		// Create copy of players and playerHand arrays for safe mutability
		const updatedPlayers = [...players];
		const playerHand = [...updatedPlayers[playerIndex].hand];

		// Remove the burn card from the hand and save it
		const burnedCard = playerHand.splice(cardIndex, 1)[0];

		// Update the players hand with the spliced array
		updatedPlayers[playerIndex].hand = playerHand;

		setPlayers(updatedPlayers);
		// The most recent burned card will always be at index 0;
		setBurnDeck((prevBurnDeck) => [burnedCard, ...prevBurnDeck]);
	}

	return (
		<PlayerContext.Provider value={{ players, setPlayers, addPlayer, burnCard }}>{children}</PlayerContext.Provider>
	);
}

function generateId() {
	const bytes = crypto.randomBytes(10);
	return bytes.toString("hex");
}

export default PlayerProvider;
