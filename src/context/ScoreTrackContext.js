import { createContext, useContext, useState } from "react";
import { PlayerContext } from "./PlayerContext";

export const ScoreTrackContext = createContext({});

function ScoreTrackProvider({ children }) {
	const { players } = useContext(PlayerContext);

	const [scoreTable, setScoreTable] = useState(() => initializeScoreTable(players));

	// Called after every round to update the score table
	function updateScoreTable(players) {
		const updatedScoreTable = { ...scoreTable };

		for (const player of players) {
			updatedScoreTable.players[player._id][updatedScoreTable.round - 1] = player.handValue;
		}
		updatedScoreTable.round += 1;

		setScoreTable(updatedScoreTable);
	}

	return (
		<ScoreTrackContext.Provider value={{ scoreTable, setScoreTable, updateScoreTable }}>
			{children}
		</ScoreTrackContext.Provider>
	);
}

function initializeScoreTable(players) {
	const table = {
		round: 1,
		players: {},
	};

	for (const player of players) {
		table.players[player._id] = [];
	}

	return table;
}

export default ScoreTrackProvider;
