import { useState } from "react";
import "./App.css";
import Papa from "papaparse";
import { Button, Card, Col, Container, Form, Row } from "react-bootstrap";
import type { PalitoData } from "./types";

const App = () => {
  const [nsptFile, setNsptFile] = useState<File | undefined>(undefined);
  const [geologyFile, setGeologyFile] = useState<File | undefined>(undefined);

  const handleGenerateJSON = async (): Promise<void> => {
    if (!nsptFile || !geologyFile) return;

    try {
      const nsptParseData = await parseFileAsync(nsptFile);
      const geologyParseData = await parseFileAsync(geologyFile);

      const palitoDataArr = convertToPalitoData(
        nsptParseData,
        geologyParseData
      );

      console.log("palitoDataArr: ", palitoDataArr);

      downloadJSON(palitoDataArr);

      // Processar dados aqui
    } catch (error) {
      console.error("Erro ao ler arquivos:", error);
    }
  };

  const convertToPalitoData = (
    nsptData: any[],
    geologyData: any[]
  ): PalitoData[] => {
    // Pegar todos os hole_ids únicos dos dois arrays
    const allHoleIds = new Set([
      ...nsptData.map((entry) => entry["HOLE ID"]),
      ...geologyData.map((entry) => entry["HOLE ID"]),
    ]);

    const palitoDataArray: PalitoData[] = [];

    allHoleIds.forEach((holeId) => {
      if (!holeId) return; // pular se hole_id for vazio

      // Filtrar dados deste hole_id específico
      const holeNsptData = nsptData.filter(
        (entry) => entry["HOLE ID"] === holeId
      );
      const holeGeologyData = geologyData.filter(
        (entry) => entry["HOLE ID"] === holeId
      );

      // Pegar todos os valores de "to" do geology, ordenar e adicionar 0 no início
      const geologyToValues = holeGeologyData
        .map((entry) => parseNumber(entry["TO"]))
        .filter((value) => !isNaN(value))
        .sort((a, b) => a - b);

      let depths = [0, ...geologyToValues];

      const depthsSet = new Set(depths);

      const uniqueDepths = [...depthsSet];

      // Pegar todas as descrições geology
      const geologyDescriptions = holeGeologyData
        .sort((a, b) => parseNumber(a["FROM"]) - parseNumber(b["FROM"])) // ordenar por "from"
        .map((entry) => String(entry["GEOLOGY"] || ""))
        .filter((desc) => desc.trim() !== "");

      // Dados do NSPT
      const nsptValues = holeNsptData
        .sort((a, b) => parseNumber(a["FROM"]) - parseNumber(b["FROM"])) // ordenar por "from"
        .map((entry) => String(entry["NSPT"] || ""))
        .filter((value) => value.trim() !== "");

      const firstNsptTo =
        holeNsptData.length > 0 ? parseNumber(holeNsptData[0]["TO"]) || 1 : 1;

      // Criar o objeto PalitoData
      const palitoEntry: PalitoData = {
        hole_id: String(holeId),
        depths: uniqueDepths,
        geology: geologyDescriptions,
        nspt: {
          start_depth: firstNsptTo,
          interval: 1,
          values: nsptValues,
        },
      };
      if (palitoEntry.geology.length > 0) {
        palitoDataArray.push(palitoEntry);
      }
    });

    return palitoDataArray;
  };

  const parseFileAsync = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          return header.toUpperCase().trim();
        },
        transform: (value: string) => {
          return typeof value === "string" ? value.trim() : value;
        },
        complete: (results) => {
          // Filtrar ANTES de resolver a Promise
          const filteredData = results.data.filter((entry: any) => {
            // Verificar se pelo menos uma propriedade tem valor válido
            return Object.values(entry).some(
              (value) =>
                value !== null &&
                value !== undefined &&
                value !== "" &&
                String(value).trim() !== ""
            );
          });
          resolve(filteredData);
        },
        error: (error) => reject(error),
      });
    });
  };

  const parseNumber = (value: any): number => {
    if (typeof value === "number") return value;
    if (!value) return 0;

    // Converter para string e limpar
    const cleanStr = String(value).trim().replace(",", "."); // troca vírgula por ponto

    const result = parseFloat(cleanStr);
    return isNaN(result) ? 0 : result;
  };

  const downloadJSON = (data: any, filename: string = "palito-data.json") => {
    // Converter objeto para JSON string formatado
    const jsonString = JSON.stringify(data, null, 2);

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + jsonString], {
      type: "application/json;charset=utf-8",
    });

    // Criar URL temporária
    const url = URL.createObjectURL(blob);

    // Criar elemento <a> invisível e simular clique
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    // Limpar
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Container fluid>
        <Row className="justify-content-center">
          <Col lg={8}>
            <Card style={{ width: "40vw" }}>
              <Card.Header>
                <h6>Converter CSV Leapfrog para JSON</h6>
              </Card.Header>
              <Card.Body>
                <Form.Group controlId="formFile" className="mb-3">
                  <Form.Label>NSPT</Form.Label>
                  <Form.Control
                    type="file"
                    size="sm"
                    onChange={(e) => {
                      const target = e.target as HTMLInputElement;
                      const file = target.files?.[0];
                      setNsptFile(file || undefined);
                    }}
                  />
                </Form.Group>
                <Form.Group controlId="formFile" className="mb-3">
                  <Form.Label>Geology</Form.Label>
                  <Form.Control
                    type="file"
                    size="sm"
                    onChange={(e) => {
                      const target = e.target as HTMLInputElement;
                      const file = target.files?.[0];
                      setGeologyFile(file || undefined);
                    }}
                  />
                </Form.Group>
                <Button onClick={handleGenerateJSON}>Gerar JSON</Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default App;
