import { useState, useEffect, useRef, useCallback } from "react";
import type { Room } from "colyseus.js";
import { createColyseusClient } from "../auth/colyseus";
import { toast } from "sonner";

export interface CardData {
  rank: number;
  suit: number;
  meldGroupId: string;
}

export interface PlayerState {
  sessionId: string;
  userId: string;
  name: string;
  score: number;
  disconnected: boolean;
  hand: CardData[];
  board: CardData[];
}

export interface StagedCard extends CardData {
  handIndex: number;
}

export function useGameRoom(roomId: string | undefined, token: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [status, setStatus] = useState("waiting");
  const [phase, setPhase] = useState("waiting");
  const [currentRound, setCurrentRound] = useState(0);
  const [wildRank, setWildRank] = useState(0);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [winnerSessionId, setWinnerSessionId] = useState("");
  const [drawPile, setDrawPile] = useState<CardData[]>([]);
  const [discardPile, setDiscardPile] = useState<CardData[]>([]);
  const [mySessionId, setMySessionId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [meldError, setMeldError] = useState<string | null>(null);
  const cleanupRef = useRef<() => void>(() => {});
  const prevHandRef = useRef<CardData[]>([]);
  const [cardOrder, setCardOrder] = useState<number[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const handledRoundRef = useRef(0);

  useEffect(() => {
    if (!token || !roomId) return;

    const client = createColyseusClient(token);
    let cancelled = false;
    let joined: Room | null = null;

    client.joinById(roomId).then((joinedRoom) => {
      if (cancelled) { joinedRoom.leave(); return; }

      joined = joinedRoom;
      setRoom(joinedRoom);
      const sessionId = joinedRoom.sessionId;
      setMySessionId(sessionId);

      const getState = () => joinedRoom.state as any;

      const updatePlayers = () => {
        if (cancelled) return;
        const state = getState();
        setStatus(state.status || "waiting");
        setPhase(state.phase || "waiting");
        setCurrentRound(state.currentRound ?? 0);
        setWildRank(state.wildRank ?? 0);
        setCurrentPlayerIndex(state.currentPlayerIndex ?? 0);
        setWinnerSessionId(state.winnerSessionId || "");
        const list: PlayerState[] = [];
        state.players?.forEach?.((p: PlayerState) => list.push(p));
        setPlayers(list);

        const rawHand = list.find((p) => p.sessionId === sessionId)?.hand;
        if (rawHand) {
          const toPlain = (cards: CardData[]) => cards.map((c) => ({ rank: c.rank, suit: c.suit, meldGroupId: c.meldGroupId }));
          const oldHand = toPlain(prevHandRef.current);
          const myHand = toPlain(rawHand);
          prevHandRef.current = myHand;
          setCardOrder((prev) => {
            if (prev.length === myHand.length) return prev;
            const surviving: number[] = [];
            for (const oldIdx of prev) {
              const oldCard = oldHand[oldIdx];
              if (!oldCard) continue;
              const newIdx = myHand.findIndex((c) => c.rank === oldCard.rank && c.suit === oldCard.suit);
              if (newIdx !== -1) surviving.push(newIdx);
            }
            for (let i = 0; i < myHand.length; i++) {
              if (!surviving.includes(i)) surviving.push(i);
            }
            return surviving;
          });
        }

        const dPile: CardData[] = [];
        state.drawPile?.forEach?.((c: CardData) => dPile.push(c));
        setDrawPile(dPile);

        const diPile: CardData[] = [];
        state.discardPile?.forEach?.((c: CardData) => diPile.push(c));
        setDiscardPile(diPile);
      };

      updatePlayers();
      joinedRoom.onStateChange(updatePlayers);

      joinedRoom.onMessage("meld_error", (msg: { message: string }) => {
        setMeldError(msg.message);
      });

      cleanupRef.current = () => {
        joinedRoom.onStateChange.remove(updatePlayers);
        joined?.leave();
      };
    }).catch((err) => {
      if (!cancelled) setError(err.message || "Failed to join room");
    });

    return () => {
      cancelled = true;
      cleanupRef.current();
    };
  }, [token, roomId]);

  useEffect(() => {
    if (meldError) toast.error(meldError);
  }, [meldError]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    if (phase === "round_ended" && status === "playing") {
      setShowCelebration(true);
    }
  }, [phase, status]);

  useEffect(() => {
    if (status === "playing" && currentRound > 0 && currentRound !== handledRoundRef.current) {
      handledRoundRef.current = currentRound;
      setShowCelebration(false);
      setShowRoundTransition(true);
    }
  }, [currentRound, status]);

  const send = useCallback((type: string, data?: any) => {
    room?.send(type, data);
  }, [room]);

  const navigateHome = useCallback(() => {
    cleanupRef.current();
  }, []);

  return {
    room,
    players,
    status,
    phase,
    currentRound,
    wildRank,
    currentPlayerIndex,
    winnerSessionId,
    drawPile,
    discardPile,
    mySessionId,
    error,
    cardOrder,
    setCardOrder,
    showCelebration,
    showRoundTransition,
    handledRoundRef,
    setShowRoundTransition,
    send,
    navigateHome,
  };
}
