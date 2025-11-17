import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";

export default function Profile() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="pt-32 pb-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold mb-8 text-center">
            Профиль
          </h1>
          
          <Card className="p-8 text-center">
            <p className="text-muted-foreground text-lg">
              Функционал профиля в разработке
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
