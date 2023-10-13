import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

const ComponentCard = ({
  name,
  version,
  description,
}: {
  name: string;
  version: number;
  description: string;
}) => {
  return (
    <Card className="bg-white dark:bg-black rounded shadow-lg flex-1">
      <CardHeader>
        <CardTitle className="font-semibold text-lg dark:text-white">
          {name}
        </CardTitle>
        <CardDescription className="text-sm text-gray-500 dark:text-gray-300">
          Version {version}.0.0
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-gray-800 dark:text-gray-100">{description}</p>
      </CardContent>
    </Card>
  );
};

export default ComponentCard;
