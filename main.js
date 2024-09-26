const jsDom = require('jsdom');
const fs = require('fs-promise');
const { JSDOM } = jsDom;

let radiatorUrl = "https://agileteknik.com/task-radiator/share/1370/25d6c550-1c59-4492-bb1b-b7ed7dcab7a9?search=&perPage=50&sortField=identifier&sortDirection=asc";

// 1. Fetch the task radiator data from the provided URL.
const fetchFromURL = async (url) => {
    return fetch(url)
        .then(response => response.text())
        .then(data => data)
        .catch(error => console.error('Error:', error));
}

// 2. Parse the fetched HTML to extract the task details.
const parseHTML = (html) => {
    // regex get inside openDetailFilppedClassroom( and ")
    const regex = new RegExp('openDetailFilppedClassroom\\(*.+\\)', 'gm')
    let match;
    let tasks = [];

    while ((match = regex.exec(html)) !== null) {
        let task = match[0].split('openDetailFilppedClassroom(')[1];
        task = task.slice(0, -1);
        tasks.push(task);
    }

    return tasks;
}

function htmlDecode(input) {
    var doc = new JSDOM(input);
    return doc.serialize().replace("<html><head></head><body>", "").replace("</body></html>", "");
}

const fetchAndExtractData = async () => {
    let html = await fetchFromURL(radiatorUrl);
    let items = await parseHTML(html);

    let jsonReady = [];
    // 3. html decode
    for (let item of items) {
        item = htmlDecode(item);
        item = JSON.parse(item);

        jsonReady.push(item);
    }

    // Save results to file
    await fs.writeFile('task_details.json', JSON.stringify(jsonReady, null, 2));
    console.log('Task details saved to task_details.json');

}

const CheckSimiliarities = async () => {
    // Load tasks
    let persons = await fs.readFile('task_details.json', 'utf8');
    persons = JSON.parse(persons);

    // Perform similarity check
    let taskList = {};

    for (let person of persons) {
        let mindMaps = person.mind_maps;
        for (let mindMap of mindMaps) {
            let similarityValue = mindMap.metadata?.similarity.value.total ?? 0;
            let mindmapName = mindMap.content?.root[0].content ?? 'Kosong';

            if (!taskList[mindmapName]) {
                taskList[mindmapName] = [];
            }

            taskList[mindmapName].push({
                name: person.name,
                similarity: similarityValue,
                mindMap: mindMap.content?.root ?? []
            })
        }
    }

    // Order the task list by similarity
    for (let name in taskList) {
        taskList[name].sort((a, b) => b.similarity - a.similarity);
    }

    return taskList
}

const NestedExtract = (mindmap, index = 1) => {
    if (mindmap == null) return "";
    let template = '\t'.repeat(index) + mindmap.content + "\n";

    if (mindmap.children) {
        for (let child of mindmap.children) {
            template += NestedExtract(child, index + 1);
        }
    }

    return template;
}

const ExtractMindmap = async (mindmap, creator, type, similarity) => {
    let mindMap = NestedExtract(mindmap);

    // Write mindmap to disk
    let filename = `results/${type}/${similarity.toString().replace('.', '_')}.${creator}.txt`;

    // If folder doesn't exist, create it
    await fs.ensureDir('results');
    await fs.ensureDir(`results/${type}`);


    await fs.writeFile(filename, mindMap);
    console.log(`Mindmap saved to ${filename}`);
}


const main = async () => {
    // await fetchAndExtractData();
    console.log('Task details fetched and saved.');
    let taskSimilarities = await CheckSimiliarities();
    console.log('Similarity check performed.');

    let taskKeys = Object.keys(taskSimilarities);
    for (let key of taskKeys) {
        let similarTasks = taskSimilarities[key];
        console.log(`\n\nMindmap: ${key}`);
        for (let task of similarTasks) {
            console.log(`Task: ${task.name}`);
            console.log(`Similarity: ${task.similarity}`);
            await ExtractMindmap(task.mindMap?.[0] ?? null, task.name, key, task.similarity);
        }
    }




}


main();