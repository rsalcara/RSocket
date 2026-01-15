#!/usr/bin/env python3
"""
Script to fix the Prometheus datasource UID in Grafana Dashboard

Usage:
    python3 scripts/fix-datasource-uid.py <NEW_UID>

Example:
    python3 scripts/fix-datasource-uid.py prometheus-uid-123

To find your datasource UID in Grafana:
    1. Go to Configuration → Data Sources
    2. Click on your Prometheus datasource
    3. Look at the URL: /datasources/edit/<UID>
    4. Copy the UID from the URL
"""

import json
import sys
import os

def update_datasource_uid(dashboard_path, old_uid, new_uid):
    """Update all datasource UIDs in the dashboard"""

    # Read dashboard
    with open(dashboard_path, 'r', encoding='utf-8') as f:
        dashboard = json.load(f)

    # Count replacements
    count = 0

    # Update panels
    for panel in dashboard.get('panels', []):
        # Update panel datasource
        if 'datasource' in panel and isinstance(panel['datasource'], dict):
            if panel['datasource'].get('uid') == old_uid:
                panel['datasource']['uid'] = new_uid
                count += 1

        # Update targets
        if 'targets' in panel:
            for target in panel['targets']:
                if 'datasource' in target and isinstance(target['datasource'], dict):
                    if target['datasource'].get('uid') == old_uid:
                        target['datasource']['uid'] = new_uid
                        count += 1

    # Write back
    with open(dashboard_path, 'w', encoding='utf-8') as f:
        json.dump(dashboard, f, indent=2, ensure_ascii=False)

    return count

def main():
    dashboard_path = 'docs/improvements/grafana/Dashboard Baileys.json'
    old_uid = 'efa2xes2233swf'

    if len(sys.argv) != 2:
        print("❌ ERRO: UID não fornecido")
        print()
        print("📋 Como usar:")
        print(f"   python3 {sys.argv[0]} <NOVO_UID>")
        print()
        print("🔍 Como encontrar o UID correto no Grafana:")
        print("   1. Abra o Grafana no navegador")
        print("   2. Vá em Configuration (⚙️) → Data Sources")
        print("   3. Clique no seu datasource Prometheus")
        print("   4. Veja a URL: .../datasources/edit/<UID>")
        print("   5. Copie o UID da URL")
        print()
        print(f"📄 Dashboard atual usa: {old_uid}")
        print()
        sys.exit(1)

    new_uid = sys.argv[1]

    print("🔧 Atualizando Datasource UID no Dashboard")
    print("=" * 50)
    print(f"📂 Arquivo: {dashboard_path}")
    print(f"🔴 UID antigo: {old_uid}")
    print(f"🟢 UID novo: {new_uid}")
    print()

    if not os.path.exists(dashboard_path):
        print(f"❌ ERRO: Arquivo não encontrado: {dashboard_path}")
        sys.exit(1)

    # Update
    count = update_datasource_uid(dashboard_path, old_uid, new_uid)

    print(f"✅ Atualizado com sucesso!")
    print(f"📊 Total de substituições: {count}")
    print()
    print("📋 Próximos passos:")
    print("   1. Importe o dashboard atualizado no Grafana")
    print("   2. Ou faça commit e push das alterações")
    print()

if __name__ == '__main__':
    main()
