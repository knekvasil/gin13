import { createContext, useState, useContext } from "react";
import { HandContext } from "./HandContext";
import { DeckContext } from "./DeckContext";

export const PlayerContext = createContext({});

function PlayerProvider({ children }) {
	const [players, setPlayers] = useState([]);

	const { setBurnDeck } = useContext(DeckContext);

	function addPlayer(name) {
		const newPlayer = {
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

export default PlayerProvider;
