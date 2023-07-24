import { createContext } from "react";

export const EvaluationContext = createContext({});

function EvaluationProvider({ children }) {
	function canPutDown(putDownSet) {
		if (putDownSet.length < 3 || putDownSet.length > 7) {
			return false;
		}

		if (putDownSet.length === 3) {
			return isValidTriple(putDownSet);
		} else if (putDownSet.length === 4) {
			if (putDownSet[0].value === putDownSet[1].value) {
			}
		} else if (putDownSet.length > 4 && putDownSet)
			for (const card of putDownSet) {
				// TODO: Determine if Quad or Straight
			}
	}
	function canBuildOff(putDownSet, buildOffSet) {}

	return <EvaluationContext.Provider value={{ canPutDown, canBuildOff }}>{children}</EvaluationContext.Provider>;
}

function isValidTriple() {
	// Four cases
	// NNN, NNW, NWW, WWW
	// If 3 wilds, choose which number they represent
	return false;
}

function isValidQuad() {
	return false;
}

function isValidStraight() {
	return false;
}

export default EvaluationProvider;
