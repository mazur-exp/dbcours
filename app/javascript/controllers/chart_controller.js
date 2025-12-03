import { Controller } from "@hotwired/stimulus"
import Chart from "chart.js/auto"

// Chart.js controller for rendering analytics charts
// Used in admin dashboard for displaying placeholder analytics data
export default class extends Controller {
  static values = {
    type: { type: String, default: "line" },
    labels: Array,
    data: Array
  }

  connect() {
    this.renderChart()
  }

  disconnect() {
    if (this.chart) {
      this.chart.destroy()
    }
  }

  renderChart() {
    const ctx = this.element.getContext("2d")

    this.chart = new Chart(ctx, {
      type: this.typeValue,
      data: {
        labels: this.labelsValue,
        datasets: [{
          label: "Данные",
          data: this.dataValue,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: this.typeValue === "bar"
            ? "rgba(34, 197, 94, 0.5)"
            : "rgba(34, 197, 94, 0.1)",
          fill: this.typeValue === "line",
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(0, 0, 0, 0.05)"
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    })
  }
}
