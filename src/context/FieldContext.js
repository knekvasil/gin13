import { createContext, useState } from "react";

export const FieldContext = createContext({});

function FieldProvider({ children }) {
	const [field, setField] = useState([]);

	return <FieldContext.Provider value={{ field, setField }}>{children}</FieldContext.Provider>;
}

export default FieldProvider;
