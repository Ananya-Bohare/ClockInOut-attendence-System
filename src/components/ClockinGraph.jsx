import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, Filler } from 'chart.js';
import moment from 'moment';
import { useMemo } from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
  Filler
);

const ClockinGraph = ({ clockInData = [], isDarkMode }) => {
  const chartData = useMemo(() => {
    const allDates = [];
    const clockInTimes = [];
    const statuses = [];

    for (let i = 6; i >= 0; i--) {
      const date = moment().subtract(i, "days");
      const dateStr = date.format("YYYY-MM-DD");

      const dataForDate = clockInData.find((entry) => entry.date === dateStr) ?? null;

      allDates.push(date);
      if (dataForDate) {
        const m = moment(dataForDate.clockIn);
        clockInTimes.push(m.isValid() ? m.hours() + m.minutes() / 60 : 0);
        statuses.push(dataForDate.status);
      } else {
        clockInTimes.push(0);
        const dayOfWeek = date.format("ddd");
        statuses.push(dayOfWeek === "Sat" || dayOfWeek === "Sun" ? "Weekend" : "No Clock-In");
      }
    }

    const labels = allDates.map((date) => date.format("MMM DD"));
    return {
      labels,
      clockInTimes,
      statuses,

      datasets: [
        {
          label: "Clock-In Time (hrs)",
          data: clockInTimes,
          borderColor: isDarkMode ? "#90CAF9" : "rgba(75,192,192,1)", // Light Blue in Dark Mode
          backgroundColor: isDarkMode ? "rgba(144, 202, 249, 0.2)" : "rgba(75,192,192,0.2)",
          fill: true,
          yAxisID: "y-axis-1",
          tension: 0.4,
          pointBackgroundColor: statuses.map((status) => {
            if (status === "On Time") return "green";
            if (status === "Late") return "red";
            if (status === "Weekend") return "blue";
            return "orange";
          }),
          pointRadius: 5,
          borderDash: clockInTimes.map((time, i) => (statuses[i] === "No Clock-In" ? [5, 5] : [])),
        },
      ],
    };
  }, [clockInData, isDarkMode]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      spanGaps: true,
      plugins: {
        title: {
          display: true,
          text: "Clock-In Activity (Last 7 Days)",
          font: { size: 16 },
          color: isDarkMode ? "#E0E0E0" : "#333", // Adjust title color
        },
        tooltip: {
          backgroundColor: isDarkMode ? "#424242" : "#fff",
          titleColor: isDarkMode ? "#E0E0E0" : "#333",
          bodyColor: isDarkMode ? "#E0E0E0" : "#333",
        },
      },
      scales: {
        x: {
          ticks: {
            color: isDarkMode ? "#B0BEC5" : "#333", // Adjust axis text color
            autoSkip: false,
            maxRotation: 0,
            callback: function (val, index) {
              return `${chartData.labels[index]} (${moment().subtract(6 - index, "days").format("ddd")})`;
            },
          },
          grid: {
            color: isDarkMode ? "#424242" : "#E0E0E0", // Adjust grid color
          },
        },
        "y-axis-1": {
          type: "linear",
          position: "left",
          title: {
            display: true,
            text: "Time (hrs)",
            color: isDarkMode ? "#E0E0E0" : "#333",
          },
          ticks: {
            color: isDarkMode ? "#B0BEC5" : "#333",
            beginAtZero: true,
            callback: (value) => {
              const timeInMinutes = value * 60;
              const hours = Math.floor(value);
              const minutes = Math.round(timeInMinutes % 60);
              return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
            },
          },
          grid: {
            color: isDarkMode ? "#424242" : "#E0E0E0",
          },
        },
      },
    }),
    [chartData, isDarkMode]
  );

  return <Line data={chartData} options={options} />;
};


export default ClockinGraph;
