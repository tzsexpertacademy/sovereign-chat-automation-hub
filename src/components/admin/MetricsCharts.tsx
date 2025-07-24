import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

interface MetricsChartsProps {
  messagesByDay: { date: string; sent: number; received: number; }[];
  instancesDistribution: { status: string; count: number; color: string; }[];
  recentGrowth: { period: string; clients: number; revenue: number; }[];
}

export const MetricsCharts = ({ messagesByDay, instancesDistribution, recentGrowth }: MetricsChartsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico de Mensagens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Volume de Mensagens (7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              sent: {
                label: "Enviadas",
                color: "hsl(var(--chart-1))",
              },
              received: {
                label: "Recebidas", 
                color: "hsl(var(--chart-2))",
              },
            }}
            className="h-[300px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={messagesByDay}>
                <defs>
                  <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="receivedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted"/>
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                />
                <YAxis className="text-xs"/>
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stackId="1"
                  stroke="hsl(var(--chart-1))"
                  fill="url(#sentGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="received"
                  stackId="1"
                  stroke="hsl(var(--chart-2))"
                  fill="url(#receivedGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Distribuição de Instâncias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Status das Instâncias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={instancesDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="count"
                  label={({ status, count }) => `${status}: ${count}`}
                  labelLine={false}
                >
                  {instancesDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Status
                              </span>
                              <span className="font-bold text-muted-foreground">
                                {data.status}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[0.70rem] uppercase text-muted-foreground">
                                Quantidade
                              </span>
                              <span className="font-bold">
                                {data.count}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {instancesDistribution.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground capitalize">{item.status}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Crescimento */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Crescimento (Últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              clients: {
                label: "Novos Clientes",
                color: "hsl(var(--chart-3))",
              },
              revenue: {
                label: "Receita (R$)",
                color: "hsl(var(--chart-4))",
              },
            }}
            className="h-[300px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentGrowth}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted"/>
                <XAxis 
                  dataKey="period" 
                  className="text-xs"
                />
                <YAxis className="text-xs"/>
                <ChartTooltip content={<ChartTooltipContent />}/>
                <Bar 
                  dataKey="clients" 
                  fill="hsl(var(--chart-3))" 
                  radius={[4, 4, 0, 0]}
                  name="Novos Clientes"
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};