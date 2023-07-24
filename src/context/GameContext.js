import { createContext, useState } from "react";

export const GameContext = createContext({});

function GameProvider({ children }) {
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
