import { Trophy } from "lucide-react";
import { useGroups } from "../context/GroupContext.jsx";
import Layout from "../components/Layout.jsx";
import Card from "../components/Card.jsx";
import GroupSelector from "../components/GroupSelector.jsx";
import GroupCup from "../components/GroupCup.jsx";

export default function Copa8a2() {
  const { activeGroupId: groupId, groups } = useGroups();

  if (groups.length === 0) {
    return (
      <Layout>
        <h1 className="text-xl sm:text-2xl font-bold mb-1">Copa 8a2</h1>
        <p className="text-gray-400 text-sm mb-6">Torneo de eliminación directa entre tu grupo, draftando jugadores reales</p>
        <Card>
          <p className="text-gray-400 text-center py-6">Necesitás estar en un grupo para jugar la Copa 8a2.</p>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-1 flex items-center gap-2">
            <Trophy size={22} className="text-accent" />
            Copa 8a2
          </h1>
          <p className="text-gray-400 text-sm">
            Cada uno arma su equipo draftando jugadores reales. Los cupos vacíos se llenan con CPU.
          </p>
        </div>
        <GroupSelector />
      </div>

      <GroupCup groupId={groupId} />
    </Layout>
  );
}
