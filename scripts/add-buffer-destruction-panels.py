#!/usr/bin/env python3
"""
Add buffer destruction monitoring panels to Grafana dashboard
"""
import json
import sys

def add_buffer_destruction_panels(dashboard_path):
    # Try different encodings
    for encoding in ['utf-8', 'latin-1', 'iso-8859-1', 'cp1252']:
        try:
            with open(dashboard_path, 'r', encoding=encoding) as f:
                dashboard = json.load(f)
            print(f"✓ Successfully read dashboard with {encoding} encoding")
            break
        except (UnicodeDecodeError, json.JSONDecodeError):
            continue
    else:
        raise ValueError("Could not read dashboard with any known encoding")

    # New panels to add
    new_panels = [
        {
            "datasource": {
                "type": "prometheus",
                "uid": "efa2xes2233swf"
            },
            "description": "Total de buffers destruídos (previne buffers órfãos)",
            "fieldConfig": {
                "defaults": {
                    "color": {
                        "mode": "thresholds"
                    },
                    "mappings": [],
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {
                                "color": "green",
                                "value": None
                            },
                            {
                                "color": "yellow",
                                "value": 10
                            },
                            {
                                "color": "red",
                                "value": 50
                            }
                        ]
                    },
                    "unit": "short"
                },
                "overrides": []
            },
            "gridPos": {
                "h": 8,
                "w": 8,
                "x": 0,
                "y": 32
            },
            "id": 111,
            "options": {
                "colorMode": "background",
                "graphMode": "area",
                "justifyMode": "center",
                "orientation": "auto",
                "percentChangeColorMode": "standard",
                "reduceOptions": {
                    "calcs": [
                        "lastNotNull"
                    ],
                    "fields": "",
                    "values": False
                },
                "showPercentChange": False,
                "textMode": "value_and_name",
                "wideLayout": True
            },
            "pluginVersion": "12.3.1",
            "targets": [
                {
                    "datasource": {
                        "type": "prometheus",
                        "uid": "efa2xes2233swf"
                    },
                    "expr": "zpro_baileys_buffer_destroyed_total",
                    "legendFormat": "Total Destruído",
                    "refId": "A"
                }
            ],
            "title": "📦 Buffers Destruídos (Total)",
            "type": "stat"
        },
        {
            "datasource": {
                "type": "prometheus",
                "uid": "efa2xes2233swf"
            },
            "description": "Taxa de destruição de buffers por minuto (monitor de desconexões)",
            "fieldConfig": {
                "defaults": {
                    "color": {
                        "mode": "palette-classic"
                    },
                    "custom": {
                        "axisBorderShow": False,
                        "axisCenteredZero": False,
                        "axisColorMode": "text",
                        "axisLabel": "Destruições/min",
                        "axisPlacement": "auto",
                        "barAlignment": 0,
                        "barWidthFactor": 0.6,
                        "drawStyle": "line",
                        "fillOpacity": 20,
                        "gradientMode": "none",
                        "hideFrom": {
                            "legend": False,
                            "tooltip": False,
                            "viz": False
                        },
                        "insertNulls": False,
                        "lineInterpolation": "linear",
                        "lineWidth": 2,
                        "pointSize": 5,
                        "scaleDistribution": {
                            "type": "linear"
                        },
                        "showPoints": "auto",
                        "showValues": False,
                        "spanNulls": False,
                        "stacking": {
                            "group": "A",
                            "mode": "none"
                        },
                        "thresholdsStyle": {
                            "mode": "off"
                        }
                    },
                    "mappings": [],
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {
                                "color": "green",
                                "value": None
                            },
                            {
                                "color": "yellow",
                                "value": 0.5
                            },
                            {
                                "color": "red",
                                "value": 2
                            }
                        ]
                    },
                    "unit": "short"
                },
                "overrides": []
            },
            "gridPos": {
                "h": 8,
                "w": 8,
                "x": 8,
                "y": 32
            },
            "id": 112,
            "options": {
                "legend": {
                    "calcs": [
                        "mean",
                        "last",
                        "max"
                    ],
                    "displayMode": "table",
                    "placement": "bottom",
                    "showLegend": True
                },
                "tooltip": {
                    "hideZeros": False,
                    "mode": "single",
                    "sort": "none"
                }
            },
            "pluginVersion": "12.3.1",
            "targets": [
                {
                    "datasource": {
                        "type": "prometheus",
                        "uid": "efa2xes2233swf"
                    },
                    "expr": "rate(zpro_baileys_buffer_destroyed_total[5m]) * 60",
                    "legendFormat": "{{reason}} (flush={{had_pending_flush}})",
                    "refId": "A"
                }
            ],
            "title": "💥 Taxa de Destruição de Buffers (por minuto)",
            "type": "timeseries"
        },
        {
            "datasource": {
                "type": "prometheus",
                "uid": "efa2xes2233swf"
            },
            "description": "Flush final forçado durante destruição (garante zero perda de dados)",
            "fieldConfig": {
                "defaults": {
                    "color": {
                        "mode": "thresholds"
                    },
                    "mappings": [],
                    "thresholds": {
                        "mode": "absolute",
                        "steps": [
                            {
                                "color": "green",
                                "value": None
                            },
                            {
                                "color": "blue",
                                "value": 5
                            }
                        ]
                    },
                    "unit": "short"
                },
                "overrides": []
            },
            "gridPos": {
                "h": 8,
                "w": 8,
                "x": 16,
                "y": 32
            },
            "id": 113,
            "options": {
                "colorMode": "value",
                "graphMode": "area",
                "justifyMode": "center",
                "orientation": "auto",
                "percentChangeColorMode": "standard",
                "reduceOptions": {
                    "calcs": [
                        "lastNotNull"
                    ],
                    "fields": "",
                    "values": False
                },
                "showPercentChange": False,
                "textMode": "value_and_name",
                "wideLayout": True
            },
            "pluginVersion": "12.3.1",
            "targets": [
                {
                    "datasource": {
                        "type": "prometheus",
                        "uid": "efa2xes2233swf"
                    },
                    "expr": "zpro_baileys_buffer_final_flush_total",
                    "legendFormat": "Flush Final",
                    "refId": "A"
                }
            ],
            "title": "🔄 Flush Final Durante Destruição",
            "type": "stat"
        }
    ]

    # Find the position to insert (before "Algoritmo Adaptativo" row)
    # We need to shift all panels with y >= 32 down by 8 (height of new row)
    for panel in dashboard['panels']:
        if panel['gridPos']['y'] >= 32:
            panel['gridPos']['y'] += 8

    # Insert new panels
    dashboard['panels'].extend(new_panels)

    # Sort panels by y position, then x position for proper rendering
    dashboard['panels'].sort(key=lambda p: (p['gridPos']['y'], p['gridPos']['x']))

    # Update version
    dashboard['version'] = dashboard.get('version', 7) + 1

    # Write back (always use UTF-8 for output)
    with open(dashboard_path, 'w', encoding='utf-8') as f:
        json.dump(dashboard, f, indent=2, ensure_ascii=True)

    print(f"✅ Added 3 buffer destruction panels to {dashboard_path}")
    print(f"   - Panel 111: Buffers Destruídos (Total)")
    print(f"   - Panel 112: Taxa de Destruição de Buffers")
    print(f"   - Panel 113: Flush Final Durante Destruição")
    print(f"📊 Dashboard version updated to {dashboard['version']}")

if __name__ == '__main__':
    dashboard_path = 'docs/improvements/grafana/Dashboard Baileys.json'
    add_buffer_destruction_panels(dashboard_path)
