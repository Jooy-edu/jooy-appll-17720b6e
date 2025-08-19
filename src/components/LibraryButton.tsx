import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const LibraryButton: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/");
  };

  return (
    <Button
      onClick={handleClick}
      className="rounded-full bg-gradient-orange-magenta hover:bg-gradient-orange-magenta text-white shadow-lg"
      size="icon"
      aria-label="Go to Library"
    >
      <Home className="h-5 w-5" />
    </Button>
  );
};

export default LibraryButton;