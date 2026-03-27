import { useRef, useEffect } from 'react';
import { Chart, registerables } from 'chart.js';
import type { ChartData } from '../types';

Chart.register(...registerables);

interface Props {
  chart: ChartData;
}

export function ChartPanel({ chart }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: chart.type,
      data: chart.data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          title: {
            display: !!chart.title,
            text: chart.title,
            font: { size: 16, weight: 'bold' },
            color: '#1e3a5f',
          },
          legend: {
            display: chart.data.datasets.length > 1,
          },
        },
        scales: chart.type === 'pie' || chart.type === 'doughnut' || chart.type === 'radar'
          ? {}
          : {
              y: { beginAtZero: true },
            },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [chart]);

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 my-3">
      <canvas ref={canvasRef} />
    </div>
  );
}
