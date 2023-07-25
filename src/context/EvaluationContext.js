import { createContext, useContext } from "react";
import { GameContext } from "./GameContext";
export const EvaluationContext = createContext({});

function EvaluationProvider({ children }) {
	const { currentWild } = useContext(GameContext);

	// Play own cards
	function canPlay(playedCards) {
		if (playedCards.length < 3 || playedCards.length > 7) {
			return false;
		}

		// Suits don't matter in multiples
		const [values, suits] = getValuesAndSuits(playedCards);
		const valueSet = new Set(values);

		// Suits and values both matter in straights
		const sanitizedCards = sanitizeAndTuple(playedCards);

		if (playedCards.length === 3) {
			return isValidMultiple(valueSet, currentWild);
		} else if (playedCards.length === 4) {
			const isQuadAttempt = [1, 2].includes(valueSet.size);

			if (isQuadAttempt) {
				isValidMultiple(valueSet, currentWild);
			} else {
				isValidStraight(sanitizedCards, currentWild);
			}
		} else if (playedCards.length > 4 && playedCards) {
			isValidStraight(sanitizedCards, currentWild);
		}
	}

	// Build off opponents cards
	function canBuild(playedCards, builtCards) {}

	return <EvaluationContext.Provider value={{ canPlay, canBuild }}>{children}</EvaluationContext.Provider>;
}

// Replaces face cards with number values
function sanitizeAndTuple(cards) {
	const tupleStore = [];
	for (const card of cards) {
		const suit = card.suit;
		let value;

		if (card.value === "J") {
			value = "11";
		} else if (card.value === "Q") {
			value = "12";
		} else if (card.value === "K") {
			value = "13";
		} else if (card.value === "A") {
			value = "14";
		} else {
			value = card.value;
		}

		const tuple = [value, suit];
		tupleStore.push(tuple);
	}

	return tupleStore;
}

// Convert all card values, suits to arrays
function getValuesAndSuits(playedCards) {
	let cardValues = [];
	let cardSuits = [];
	for (const card of playedCards) {
		cardValues += card.value;
		cardSuits.push(card.suit[0]);
	}
	return [cardValues, cardSuits];
}

function isValidMultiple(valueSet, wild) {
	if (valueSet.size === 1 || (valueSet.size === 2 && valueSet.has(wild))) {
		return true;
	}
	return false;
}

function isValidStraight(cardTuples, currentWild) {
	// [["5", "H"], ["6", "H"], ["7", "H"], ["8", "H"]]
	const playedTuples = [...cardTuples];
	const wilds = [];
	// Separate wilds and regular cards
	for (let i = 0; i < playedTuples.length; i++) {
		if (playedTuples[i][0] === currentWild) {
			const removedWild = playedTuples.splice(i, 1)[0];
			wilds.push(removedWild);
		}
	}

	const allSuitsUniform = areSuitsUniform(playedTuples);
	if (!allSuitsUniform) {
		return false;
	}
	// Sort regular cards
	playedTuples.sort((a, b) => Number(a[0]) - Number(b[0]));

	// Find amount of holes in regular straight
	const numberOfHoles = findNumberOfHoles(playedTuples);

	// If no holes or enough wilds to cover holes, return true
	return numberOfHoles === 0 || wilds.length >= numberOfHoles;
}

function areSuitsUniform(tupleArray) {
	const baseSuit = tupleArray[0][1];
	for (const tuple of tupleArray) {
		if (tuple[1] !== baseSuit) {
			return false;
		}
	}
	return true;
}

function findNumberOfHoles(tupleArray) {
	let numberOfHoles = 0;
	for (let i = 0; i < tupleArray.length - 1; i++) {
		const currentValue = Number(tupleArray[i][0]);
		const nextValue = Number(tupleArray[i + 1][0]);
		const difference = nextValue - currentValue;
		if (difference > 1) {
			numberOfHoles += difference - 1;
		}
	}
	return numberOfHoles;
}

export default EvaluationProvider;
