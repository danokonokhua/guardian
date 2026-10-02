import { checkBetaDeployment } from "../lib/beta-readiness";
checkBetaDeployment(process.argv[2] ?? "http://localhost:3000")
  .then((report) => {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (!report.technicalChecksPassed) process.exitCode = 1;
  })
  .catch(() => {
    process.stderr.write(
      "Readiness check failed. Supply an HTTPS application origin, or a loopback HTTP origin, without credentials or paths.\n",
    );
    process.exitCode = 1;
  });
