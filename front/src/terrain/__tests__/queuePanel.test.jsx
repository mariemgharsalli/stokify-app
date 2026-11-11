import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QueuePanel from "../offline/QueuePanel";
import { mettreEnFile, useMemoryQueueForTests } from "../offline/queue";
import { fr } from "../strings/fr";

vi.mock("../lib/useOnlineStatus", () => ({ useOnlineStatus: () => false }));

describe("bandeau de file", () => {
  beforeEach(() => {
    useMemoryQueueForTests();
  });

  it("affiche le nombre, le détail, et laisse supprimer", async () => {
    await mettreEnFile({ sessionKey: "1:7", inventaireId: 4, ligneId: 2, qteReelle: 6, label: "Vis" });
    render(<QueuePanel sessionKey="1:7" />);
    fireEvent.click(await screen.findByRole("button", { name: /1 actions en attente/ }));
    expect(screen.getByText("Vis")).toBeTruthy();
    expect(screen.getByText(fr.queueBlocked)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: fr.queueDrop }));
    await waitFor(() => expect(screen.queryByText("Vis")).toBeNull());
  });
});
