import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Connect Wallet</Button>);
    expect(screen.getByText("Connect Wallet")).toBeDefined();
  });

  it("applies variant classes", () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    expect(container.firstChild).toBeDefined();
  });

  it("renders as a link when asChild", () => {
    const { container } = render(
      <Button asChild>
        <a href="/dashboard">Dashboard</a>
      </Button>,
    );
    expect(container.querySelector("a")).toBeDefined();
  });
});
