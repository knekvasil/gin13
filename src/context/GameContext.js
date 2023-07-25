import { createContext, useState } from "react";

export const GameContext = createContext({});

function GameProvider({ children }) {
	const rounds = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

	const [gameState, setGameState] = useState(() => initializeGame());
	const [currentWild, setCurrentWild] = "A";

	return (
		<GameContext.Provider value={{ gameState, setGameState, currentWild, setCurrentWild }}>
			{children}
		</GameContext.Provider>
	);
}

function initializeGame() {
	return 0;
}

export default GameProvider;
