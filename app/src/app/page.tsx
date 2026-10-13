import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>SummitHack starter</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Check the service status at <a className="underline" href="/api/health">/api/health</a>.</p>
      </CardContent>
    </Card>
  );
}
